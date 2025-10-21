package main

import (
	"image/png"
	"os"

	"github.com/Hultan/chessImager"

	"context"
	"fmt"
	"log"

	"github.com/chromedp/chromedp"
	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
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
		if update.Message == nil {
			continue
		}

		if update.Message.Text == "/screenshot" {
			ProcessRandomCSVFile()

			// // initialize a controllable Chrome instance
			// ctx, cancel := chromedp.NewContext(
			// 	context.Background(),
			// )
			// // release the browser resources when
			// // it is no longer needed
			// defer cancel()

			// // capture screenshot of complete page
			// if err := captureFullPageScreenshot(ctx); err != nil {
			// 	log.Print("Error capturing full page screenshot:", err)
			// }
			// fmt.Println("Success")
			// if err != nil {
			// 	log.Printf("Error taking screenshot: %v", err)
			// 	msg := tgbotapi.NewMessage(update.Message.Chat.ID, "Error taking screenshot")
			// 	bot.Send(msg)
			// 	continue
			// }
			fmt.Println("1...")
			// Send photo
			photo := tgbotapi.NewPhoto(update.Message.Chat.ID, tgbotapi.FilePath("chessboard.png"))
			photo.Caption = "Chess puzzle screenshot"
			_, err = bot.Send(photo)
			if err != nil {
				log.Printf("Error sending photo: %v", err)
			}
			fmt.Println("2....")

			// Clean up screenshot file
			os.Remove("full-page-screenshot.png")
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

func ProcessRandomCSVFile() {
	// fen := "1rb5/4r3/3p1npb/3kp1P1/1P3P1P/5nR1/2Q1BK2/bN4NR w - - 3 61" // Starting position FEN
	fen, _, err := FenGenerator("../public/test.csv")

	// Create a new imager and render the FEN
	img, err := chessImager.NewImager().Render(fen)
	if err != nil {
		fmt.Println("Error rendering image:", err)
		return
	}

	// Save the image to a file
	file, err := os.Create("chessboard.png")
	if err != nil {
		fmt.Println("Error creating file:", err)
		return
	}
	defer file.Close()

	err = png.Encode(file, img)
	if err != nil {
		fmt.Println("Error encoding image:", err)
		return
	}

	fmt.Println("Chessboard image 'chessboard.png' created successfully.")

}
