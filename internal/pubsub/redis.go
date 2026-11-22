package pubsub

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisPubSub struct {
	client *redis.Client
	subs   map[string]*redis.PubSub
	handler func(channel string, message []byte)
}

func NewRedisPubSub(addr string, db int) *RedisPubSub {
	client := redis.NewClient(&redis.Options{
		Addr: addr,
		DB:   db,
	})

	return &RedisPubSub{
		client: client,
		subs:   make(map[string]*redis.PubSub),
	}
}

func (r *RedisPubSub) Ping(ctx context.Context) error {
	return r.client.Ping(ctx).Err()
}

func (r *RedisPubSub) Publish(ctx context.Context, channel string, msg interface{}) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	return r.client.Publish(ctx, channel, data).Err()
}

func (r *RedisPubSub) Subscribe(ctx context.Context, channel string) (<-chan string, error) {
	pubsub := r.client.Subscribe(ctx, channel)
	r.subs[channel] = pubsub

	ch := make(chan string, 100)
	go func() {
		defer close(ch)
		for msg := range pubsub.Channel() {
			ch <- msg.Payload
		}
	}()

	return ch, nil
}

func (r *RedisPubSub) SubscribeToCampaign(ctx context.Context, campaignID int64, handler func(msg []byte)) error {
	channel := fmt.Sprintf("campaign:%d", campaignID)

	pubsub := r.client.Subscribe(ctx, channel)
	r.subs[channel] = pubsub

	go func() {
		for msg := range pubsub.Channel() {
			handler([]byte(msg.Payload))
		}
	}()

	return nil
}

func (r *RedisPubSub) Close() {
	for _, sub := range r.subs {
		sub.Close()
	}
	r.client.Close()
}

// FanoutMessage represents a message to be distributed to all campaign members
type FanoutMessage struct {
	Type      string      `json:"type"`
	CampaignID int64      `json:"campaign_id"`
	Payload   interface{} `json:"payload"`
	Timestamp int64       `json:"timestamp"`
	// To restricts delivery to these user ids (empty = every campaign member).
	To []int64 `json:"to,omitempty"`
}

func PublishCampaignEvent(ctx context.Context, redis *RedisPubSub, campaignID int64, eventType string, payload interface{}) error {
	msg := FanoutMessage{
		Type:       eventType,
		CampaignID: campaignID,
		Payload:    payload,
		Timestamp:  systemTimestamp(),
	}

	channel := fmt.Sprintf("campaign:%d", campaignID)
	return redis.Publish(ctx, channel, msg)
}

// PublishCampaignEventTo is PublishCampaignEvent limited to the given users.
func PublishCampaignEventTo(ctx context.Context, redis *RedisPubSub, campaignID int64, userIDs []int64, eventType string, payload interface{}) error {
	msg := FanoutMessage{Type: eventType, CampaignID: campaignID, Payload: payload, Timestamp: systemTimestamp(), To: userIDs}
	return redis.Publish(ctx, fmt.Sprintf("campaign:%d", campaignID), msg)
}

func systemTimestamp() int64 {
	return time.Now().Unix()
}

func init() {
	_ = log.Println
}