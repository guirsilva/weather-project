package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/streadway/amqp"
)

func main() {
	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)

	conn, err := amqp.Dial("amqp://guest:guest@localhost:5672/")
	if err != nil {
		log.Fatalf("Connection failed: %v", err)
	}
	defer conn.Close()

	ch, err := conn.Channel()
	if err != nil {
		log.Fatalf("Failed to open channel: %v", err)
	}
	defer ch.Close()

	_, err = ch.QueueDeclare(
		"local_weather",
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		log.Fatalf("Failed to declare queue: %v", err)
	}

	msgs, err := ch.Consume(
		"local_weather",
		"",
		false,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		log.Fatalf("Failed to initialize consumer: %v", err)
	}

	log.Println("Worker initialized. Waiting for messages...")

	go func() {
		for msg := range msgs {
			log.Printf("Received message: %s", msg.Body)

			time.Sleep(2 * time.Second)

			if err := msg.Ack(false); err != nil {
				log.Printf("Ack error: %v", err)
			} else {
				log.Println("Confirmed message")
			}
		}
	}()

	<-sigs
	log.Println("Shutdown signal received. Terminating...")

	time.Sleep(1 * time.Second)
	log.Println("Shutdown completed.")
}