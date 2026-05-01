package main

import (
	"encoding/json"
	"log"
	"math/rand"
	"net/http"
	"sync"
	"time"
)

// Reward tiers
type Tier string

const (
	TierMythic     Tier = "mythic"
	TierLegendary  Tier = "legendary"
	TierEpic       Tier = "epic"
	TierCoin       Tier = "coin"
)

type Reward struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Tier      Tier   `json:"tier"`
	CoinVal   int    `json:"coin_value,omitempty"`
	IsWeapon  bool   `json:"is_weapon"`
}

// Full reward pool -> 20 rewards total
// 3 mythic weapons, 2 legendary weapons, 2 epic rewards, rest are coins
var rewardPool = []Reward{
	// MYTHIC WEAPONS
	{ID: "mw1", Name: "Shadow Reaper", Tier: TierMythic, IsWeapon: true},
	{ID: "mw2", Name: "Void Striker", Tier: TierMythic, IsWeapon: true},
	{ID: "mw3", Name: "Crimson Eclipse", Tier: TierMythic, IsWeapon: true},
 
	// LEGENDARY WEAPONS
	{ID: "lw1", Name: "Storm Cleaver", Tier: TierLegendary, IsWeapon: true},
	{ID: "lw2", Name: "Inferno Pulse", Tier: TierLegendary, IsWeapon: true},
 
	// EPIC REWARDS 
	{ID: "ep1", Name: "Phantom Armor", Tier: TierEpic, IsWeapon: false},
	{ID: "ep2", Name: "Neon Parachute", Tier: TierEpic, IsWeapon: false},
 
	// COIN REWARDS (13) - varying amounts
	{ID: "c100", Name: "100 Coins", Tier: TierCoin, CoinVal: 100, IsWeapon: false},
	{ID: "c10a", Name: "10 Coins", Tier: TierCoin, CoinVal: 10, IsWeapon: false},
	{ID: "c10b", Name: "10 Coins", Tier: TierCoin, CoinVal: 10, IsWeapon: false},
	{ID: "c5a", Name: "5 Coins", Tier: TierCoin, CoinVal: 5, IsWeapon: false},
	{ID: "c5b", Name: "5 Coins", Tier: TierCoin, CoinVal: 5, IsWeapon: false},
	{ID: "c5c", Name: "5 Coins", Tier: TierCoin, CoinVal: 5, IsWeapon: false},
	{ID: "c3a", Name: "3 Coins", Tier: TierCoin, CoinVal: 3, IsWeapon: false},
	{ID: "c3b", Name: "3 Coins", Tier: TierCoin, CoinVal: 3, IsWeapon: false},
	{ID: "c3c", Name: "3 Coins", Tier: TierCoin, CoinVal: 3, IsWeapon: false},
	{ID: "c2a", Name: "2 Coins", Tier: TierCoin, CoinVal: 2, IsWeapon: false},
	{ID: "c2b", Name: "2 Coins", Tier: TierCoin, CoinVal: 2, IsWeapon: false},
	{ID: "c1a", Name: "1 Coin", Tier: TierCoin, CoinVal: 1, IsWeapon: false},
	{ID: "c1b", Name: "1 Coin", Tier: TierCoin, CoinVal: 1, IsWeapon: false},
}

// Weighted probabilities (must sum to 10000 for precision)
// Mythic: 0.6% each = 1.8% total
// Legendary: 2% each = 4% total
// Epic: 5% each = 10% total
// Coins: remainder distributed by rarity
var weights = map[string]int{
	"mw1":  60,
	"mw2":  60,
	"mw3":  60,
	"lw1":  200,
	"lw2":  200,
	"ep1":  500,
	"ep2":  500,
	"c100": 30,
	"c10a": 200,
	"c10b": 200,
	"c5a":  400,
	"c5b":  400,
	"c5c":  400,
	"c3a":  700,
	"c3b":  700,
	"c3c":  700,
	"c2a":  1200,
	"c2b":  1200,
	"c1a":  1145,
	"c1b":  1145,
}

// session  state -> in memory per session id
type SessionState struct {
	PityCounter int
	CollectedCoins int
}

var (
	sessions = make(map[string]*SessionState)
	sessionsMu sync.Mutex
	rng = rand.New(rand.NewSource(time.Now().UnixNano()))
)

func getOrCreateSession(id string) *SessionState {
	sessionsMu.Lock()
	defer sessionsMu.Unlock()

	if _, ok := sessions[id]; !ok {
		sessions[id] = &SessionState{}
	}
	return sessions[id]
}

func spinReward(session *SessionState) Reward {
	session.PityCounter++

	// pity after 100 spins to guarantee mythic
	if session.PityCounter >= 100 {
		session.PityCounter = 0
		mythics := []Reward{rewardPool[0], rewardPool[1], rewardPool[2]}
		return mythics[rng.Intn(len(mythics))]
	}

	// Build cumulative wait table
	total := 0
	for _, w := range weights {
		total += w
	} 

	roll := rng.Intn(total)
	cumulative := 0
	for _, r := range rewardPool {
		w := weights[r.ID]
		cumulative += w
		if roll < cumulative {
			if r.Tier == TierMythic || r.Tier == TierLegendary {
				session.PityCounter = 0
			} 
			return r
		}
	}
	// fallback
	return rewardPool[len(rewardPool)-1]
}

type SpinResponse struct {
	Reward   Reward `json:"reward"`
	PityCounter int `json:"pity_counter"`
	CollectedCoins int `json:"collected_coins"`
}

type RedeemRequest struct {
	SessionID  string `json:"session_id"`
	WeaponID  string `json:"weapon_id"`
}

type RedeemResponse struct {
	Success   bool `json:"success"`
	Message   string `json:"message"`
	CollectedCoins int `json:"collected_coins"`
}


// Redeem coins needed to redeem each weapon 
var redeemCosts = map[string]int {
	"mw1": 500,
	"mw2": 500,
	"mw3": 500,
	"lw1": 200,
	"lw2": 200,
	"ep1": 80,
	"ep2": 80,
}



func enableCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next(w, r)		
	}
}


func spinHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	sessionID := r.URL.Query().Get("session")
	if sessionID == "" {
		sessionID = "default"
	}

	session := getOrCreateSession(sessionID)
	reward := spinReward(session)

	if reward.Tier == TierCoin {
		session.CollectedCoins += reward.CoinVal
	} 

	resp := SpinResponse {
		Reward: reward,
		PityCounter: session.PityCounter,
		CollectedCoins: session.CollectedCoins,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}


func redeemHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
 
	var req RedeemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
 
	session := getOrCreateSession(req.SessionID)
	cost, ok := redeemCosts[req.WeaponID]
	if !ok {
		http.Error(w, "unknown weapon", http.StatusBadRequest)
		return
	}
 
	resp := RedeemResponse{CollectedCoins: session.CollectedCoins}
	if session.CollectedCoins >= cost {
		session.CollectedCoins -= cost
		resp.Success = true
		resp.Message = "Weapon redeemed successfully!"
		resp.CollectedCoins = session.CollectedCoins
	} else {
		resp.Success = false
		resp.Message = "Not enough coins to redeem this weapon."
	}
 
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}



func poolHandler(w http.ResponseWriter, r *http.Request) {
	type PoolItem struct {
		Reward Reward  `json:"reward"`
		Chance float64 `json:"chance"`
		Cost   int     `json:"redeem_cost,omitempty"`
	}
 
	total := 0
	for _, w := range weights {
		total += w
	}
 
	var items []PoolItem
	for _, r := range rewardPool {
		chance := float64(weights[r.ID]) / float64(total) * 100
		item := PoolItem{Reward: r, Chance: chance}
		if c, ok := redeemCosts[r.ID]; ok {
			item.Cost = c
		}
		items = append(items, item)
	}
 
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}


func main() {
	http.HandleFunc("/spin", enableCORS(spinHandler))
	http.HandleFunc("/redeem", enableCORS(redeemHandler))
	http.HandleFunc("/pool", enableCORS(poolHandler))
 
	log.Println("Gacha backend running on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

