package main

import (
	"context"
	"errors"
	httpapi "feetwork/internal/http"
	"feetwork/internal/repository/postgres"
	"feetwork/internal/service"
	"github.com/jackc/pgx/v5/pgxpool"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"
)

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(log); err != nil {
		log.Error("server stopped", "error", err)
		os.Exit(1)
	}
}
func run(log *slog.Logger) error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	config, err := pgxpool.ParseConfig(env("DATABASE_URL", "postgres://feetwork:feetwork_local@localhost:5438/feetwork?sslmode=disable"))
	if err != nil {
		return err
	}
	config.MaxConns = 15
	config.MinConns = 2
	config.MaxConnLifetime = time.Hour
	config.ConnConfig.ConnectTimeout = 5 * time.Second
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return err
	}
	defer pool.Close()
	ping, cancel := context.WithTimeout(ctx, 10*time.Second)
	err = pool.Ping(ping)
	cancel()
	if err != nil {
		return err
	}
	svc := &service.Service{Store: &postgres.Store{Pool: pool}}
	origins := strings.Split(env("CORS_ORIGINS", "http://localhost:5178,http://localhost:3000"), ",")
	for i := range origins {
		origins[i] = strings.TrimSpace(origins[i])
	}
	server := &http.Server{Addr: env("HTTP_ADDR", ":8088"), Handler: httpapi.Router(svc, origins, log), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 35 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 1 << 20}
	failures := make(chan error, 1)
	go func() {
		log.Info("listening", "address", server.Addr, "mode", "single-demo-user")
		failures <- server.ListenAndServe()
	}()
	select {
	case err := <-failures:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-ctx.Done():
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdown); err != nil {
			_ = server.Close()
			return err
		}
	}
	return nil
}
