package main

import (
	crand "crypto/rand"
	"encoding/base64"
	"math/rand"
	"time"
)

var (
	letterRunes = []rune("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")
)

// GenerateServiceID generates a new ID for use with services
func GenerateServiceID() string {
	return GenerateRandomString(24)
}

// GenerateRandomString generates a random string of a specified length
func GenerateRandomString(length int) string {
	if length > 0 {
		rand.Seed(time.Now().UnixNano())
		chars := make([]rune, length)
		for i := range chars {
			chars[i] = letterRunes[rand.Intn(len(letterRunes))]
		}

		return string(chars)
	}

	return ""
}

// GenerateSecureRandomBytes generates a random set of bytes using a
// secure rng
func GenerateSecureRandomBytes(length int) ([]byte, error) {
	bytes := make([]byte, length)
	_, err := crand.Read(bytes)

	if err != nil {
		Error.Println("Error while generating secure bytes")
		return nil, err
	}

	return bytes, nil
}

// GenerateSecureRandomString generates a securely random string of a specified length
func GenerateSecureRandomString(length int) (string, error) {
	data, err := GenerateSecureRandomBytes(length)

	if err != nil {
		return "", err
	}

	return base64.URLEncoding.EncodeToString(data), nil
}
