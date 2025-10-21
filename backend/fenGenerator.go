package main

import (
	"encoding/csv"
	"fmt"
	"math/rand"
	"os"
	"time"
)

func FenGenerator(filePath string) (string, string, error) {
	// Open the CSV file
	file, err := os.Open(filePath)
	if err != nil {
		return "", "", fmt.Errorf("could not open CSV file: %v", err)
	}
	defer file.Close()

	// Read the CSV content
	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		return "", "", fmt.Errorf("could not read CSV: %v", err)
	}

	// Seed the random number generator and pick a random index
	rand.Seed(time.Now().UnixNano())
	randomIndex := rand.Intn(len(records))

	// Get the FEN string and best move from the random record
	fen := records[randomIndex][0]
	bestMove := records[randomIndex][1]
	return fen, bestMove, nil
}
