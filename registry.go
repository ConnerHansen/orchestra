package main

import "sync"

// Registry is a simple struct for storing arbitrary data in a concurrency
// safe way
type Registry struct {
	Data  map[interface{}]interface{}
	Mutex *sync.RWMutex
}

// NewRegistry creates a new registry struct
func NewRegistry() *Registry {
	return &Registry{
		Data:  make(map[interface{}]interface{}),
		Mutex: &sync.RWMutex{},
	}
}

// Get returns the value from the registry, if it exists, as well as a bool
// to indicate whether the get was successful or not
func (r *Registry) Get(key interface{}) (interface{}, bool) {
	// Read lock since we're just doing a get,
	// so no reason to block other readers
	r.Mutex.RLock()
	defer r.Mutex.RUnlock()

	if val, ok := r.Data[key]; ok {
		return val, true
	}

	return nil, false
}

// Remove will attempts to remove the given key from the registry and returns
// the removed value if found and a bool indicating whether the key was
// matched or not
func (r *Registry) Remove(key interface{}) (interface{}, bool) {
	// Full lock since we're modifying the data
	r.Mutex.Lock()
	defer r.Mutex.Unlock()

	if val, ok := r.Data[key]; ok {
		delete(r.Data, key)
		return val, true
	}

	return nil, false
}

// Set sets the value in the given registry
func (r *Registry) Set(key, value interface{}) {
	// Full lock since we're modifying the data
	r.Mutex.Lock()
	defer r.Mutex.Unlock()
	r.Data[key] = value
}
