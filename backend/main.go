package main

import (
	"image/png"
	"os"
	"sync"

	"github.com/Hultan/chessImager"

	"context"
	"fmt"
	"log"

	"github.com/MUSTAFA-A-KHAN/telegram-bot-anime/view"

	"github.com/chromedp/chromedp"
	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

var (
	activePuzzles = make(map[int64]string)        // chatID -> bestMove
	userScores    = make(map[int64]map[int64]int) // chatID -> userID -> score
	mu            sync.RWMutex
)

func main() {
	// Get bot token from environment variable
	botToken := "7974923994:AAEZJklUXMlr107CweOV0y48DsAeAcmpqQg"
	if botToken == "" {
		log.Fatal("TELEGRAM_BOT_TOKEN environment variable is required")
	}

	// Create bot
	bot, err := tgbotapi.NewBotAPI(botToken)
	if err != nil {
		log.Fatal(err)
	}

	log.Printf("Authorized on account %s", bot.Self.UserName)

	// Set up updates channel
	u := tgbotapi.NewUpdate(0)
	u.Timeout = 60

	updates := bot.GetUpdatesChan(u)

	// Handle updates
	for update := range updates {
		if update.InlineQuery != nil {
			fmt.Println("Inline query received!")

			// Generate new chessboard image
			BestMove, err := ProcessRandomCSVFile()
			if err != nil {
				log.Println("Failed to generate chessboard:", err)
				continue
			}

			// Send the photo to upload chat to get file_id
			uploadChatID := int64(-1002401314616)
			photoMsg := tgbotapi.NewPhoto(uploadChatID, tgbotapi.FilePath("chessboard.png"))
			sentMsg, err := bot.Send(photoMsg)
			if err != nil {
				log.Println("Failed to send photo for file_id:", err)
				continue
			}
			bot.Send(tgbotapi.NewMessage(uploadChatID, BestMove))

			// Get file_id from the sent message
			if len(sentMsg.Photo) == 0 {
				log.Println("No photo in sent message")
				continue
			}
			fileID := sentMsg.Photo[0].FileID

			// Delete the sent message to avoid spamming the channel
			_, err = bot.Request(tgbotapi.DeleteMessageConfig{ChatID: uploadChatID, MessageID: sentMsg.MessageID})
			if err != nil {
				log.Println("Failed to delete message:", err)
			}

			photo := tgbotapi.NewInlineQueryResultPhoto(
				"unique-id-123", // unique ID for this inline result
				fileID,          // Telegram file ID
			)
			photo.Caption = "Checkmate in one Move!"

			inlineConf := tgbotapi.InlineConfig{
				InlineQueryID: update.InlineQuery.ID,
				IsPersonal:    true,
				CacheTime:     0,
				Results:       []interface{}{photo},
			}

			if _, err := bot.Request(inlineConf); err != nil {
				log.Println("Failed to answer inline query:", err)
			}
		}
		if update.Message == nil {
			continue
		}

		chatID := update.Message.Chat.ID
		userID := update.Message.From.ID
		text := update.Message.Text
		messasgeID := update.Message.MessageID

		switch text {
		case "/screenshot":
			bestMove, err := ProcessRandomCSVFile()
			if err != nil {
				msg := tgbotapi.NewMessage(chatID, "Error generating puzzle")
				bot.Send(msg)
				continue
			}

			mu.Lock()
			activePuzzles[chatID] = bestMove
			mu.Unlock()

			// Send photo
			photo := tgbotapi.NewPhoto(chatID, tgbotapi.FilePath("chessboard.png"))
			photo.Caption = "Guess the best move! Reply with your answer."
			_, err = bot.Send(photo)
			if err != nil {
				log.Printf("Error sending photo: %v", err)
			}

		case "/score":
			mu.RLock()
			scores, exists := userScores[chatID]
			mu.RUnlock()

			if !exists || len(scores) == 0 {
				msg := tgbotapi.NewMessage(chatID, "No scores yet!")
				bot.Send(msg)
				continue
			}

			scoreText := "Current Scores:\n"
			for uid, score := range scores {
				scoreText += fmt.Sprintf("User %d: %d points\n", uid, score)
			}
			msg := tgbotapi.NewMessage(chatID, scoreText)
			bot.Send(msg)

		default:
			mu.RLock()
			expectedMove, hasPuzzle := activePuzzles[chatID]
			mu.RUnlock()

			if hasPuzzle {
				if text == expectedMove {
					// Correct guess
					mu.Lock()
					if userScores[chatID] == nil {
						userScores[chatID] = make(map[int64]int)
					}
					userScores[chatID][userID]++
					delete(activePuzzles, chatID)
					mu.Unlock()

					msg := tgbotapi.NewMessage(chatID, fmt.Sprintf("Correct! %s is the best move. You earned a point!", expectedMove))
					view.ReactToMessage(botToken, chatID, messasgeID, "🎉", true)
					bot.Send(msg)
				} else {
					// Incorrect guess
					msg := tgbotapi.NewMessage(chatID, "Wrong! Try again.")
					view.ReactToMessage(botToken, chatID, messasgeID, "🤔", true)
					bot.Send(msg)
				}
			}
		}
	}
}

func takeScreenshot() (string, error) {
	fmt.Println("9...")

	// Create context
	ctx, cancel := chromedp.NewContext(context.Background())
	defer cancel()
	fmt.Println("10...")

	// Screenshot file path
	screenshotPath := "screenshot.png"

	// Run chromedp tasks
	var buf []byte
	err := chromedp.Run(ctx,
		chromedp.Navigate("http://localhost:3000"),
		chromedp.WaitVisible("body"),       // Wait for page to load
		chromedp.FullScreenshot(&buf, 100), // Full page screenshot
	)
	fmt.Println("3...")
	if err != nil {
		return "", fmt.Errorf("failed to take screenshot: %w", err)
	}

	// Save screenshot to file
	fmt.Println("4...")
	err = os.WriteFile(screenshotPath, buf, 0644)
	if err != nil {
		return "", fmt.Errorf("failed to save screenshot: %w", err)
	}
	fmt.Println("5...")
	return screenshotPath, nil
}

// function to capture screenshot of complete page
func captureFullPageScreenshot(ctx context.Context) error {
	fmt.Println("11")
	var screenshotBuffer []byte
	err := chromedp.Run(ctx,
		chromedp.Navigate("http://localhost:3000"),
		chromedp.FullScreenshot(&screenshotBuffer, 100),
	)
	if err != nil {
		return err
	}

	// file permissions: 0644 (Owner: read/write, Group: read, Others: read)
	// write the response body to an image file
	err = os.WriteFile("full-page-screenshot.png", screenshotBuffer, 0644)
	if err != nil {
		return err
	}

	return nil
}

// ProcessRandomCSV accepts a file path to a CSV, processes a random FEN position, and returns the image path and best move.
// func ProcessRandomCSV(filePath string) (string, string, error) {
// 	// Open the CSV file
// 	file, err := os.Open(filePath)
// 	if err != nil {
// 		return "", "", fmt.Errorf("could not open CSV file: %v", err)
// 	}
// 	defer file.Close()

// 	// Read the CSV content
// 	reader := csv.NewReader(file)
// 	records, err := reader.ReadAll()
// 	if err != nil {
// 		return "", "", fmt.Errorf("could not read CSV: %v", err)
// 	}

// 	// Seed the random number generator and pick a random index
// 	rand.Seed(time.Now().UnixNano())
// 	randomIndex := rand.Intn(len(records))

// 	// Get the FEN string and best move from the random record
// 	fen := records[randomIndex][0]
// 	bestMove := records[randomIndex][1]

// 	// Create a new game from the FEN string
// 	game := chess.NewGame()
// 	if err := game.LoadFEN(fen); err != nil {
// 		return "", "", fmt.Errorf("could not load FEN: %v", err)
// 	}

// 	// Render the board image
// 	img, err := image.New(game.Board(), image.PieceImages(image.ClassicPieces))
// 	if err != nil {
// 		return "", "", fmt.Errorf("could not render image: %v", err)
// 	}

// 	// Save the board image as PNG
// 	imagePath := fmt.Sprintf("board_random_%d.png", randomIndex+1)
// 	f, err := os.Create(imagePath)
// 	if err != nil {
// 		return "", "", fmt.Errorf("could not create image file: %v", err)
// 	}
// 	defer f.Close()

// 	if err := img.Save(f); err != nil {
// 		return "", "", fmt.Errorf("could not save image: %v", err)
// 	}

// 	// Return the image path and the checkmate move (best move)
// 	return imagePath, bestMove, nil
// }

func ProcessRandomCSVFile() (string, error) {
	// fen := "1rb5/4r3/3p1npb/3kp1P1/1P3P1P/5nR1/2Q1BK2/bN4NR w - - 3 61" // Starting position FEN
	fen, bestMove, err := FenGenerator("../public/test.csv")
	if err != nil {
		return "", fmt.Errorf("failed to generate FEN: %w", err)
	}

	// Create a new imager and render the FEN
	img, err := chessImager.NewImager().Render(fen)
	if err != nil {
		return "", fmt.Errorf("error rendering image: %w", err)
	}

	// Save the image to a file
	file, err := os.Create("chessboard.png")
	if err != nil {
		return "", fmt.Errorf("error creating file: %w", err)
	}
	defer file.Close()

	err = png.Encode(file, img)
	if err != nil {
		return "", fmt.Errorf("error encoding image: %w", err)
	}

	fmt.Println("Chessboard image 'chessboard.png' created successfully.")
	return bestMove, nil
}
