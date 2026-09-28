// cmd/server/main.go
package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"github.com/KunjJoshi/testlab-backend/internal/auth"
	"github.com/KunjJoshi/testlab-backend/internal/handlers"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found, relying on environment variables")
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL is not set")
	}

	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		log.Fatalf("failed to connect to db: %v", err)
	}
	defer pool.Close()

	mux := http.NewServeMux()

	issuerURL := os.Getenv("ISSUER_URL")
	if issuerURL == "" {
		issuerURL = "http://localhost:8080"
		log.Println("ISSUER_URL not set, defaulting to http://localhost:8080")
	}

	cimdCache := auth.NewCIMDCache()
	authorizeHandler := &handlers.AuthorizeHandler{DB: pool, CIMDCache: cimdCache}

	discoveryHandler := &handlers.DiscoveryHandler{IssuerURL: issuerURL}
	tokenHandler := &handlers.TokenHandler{DB: pool}
	mux.HandleFunc("POST /token", tokenHandler.Token)
	mux.HandleFunc("GET /.well-known/oauth-authorization-server", discoveryHandler.GetAuthServerMetadata)
	mux.HandleFunc("GET /authorize", authorizeHandler.Authorize)
	// -- public: no auth wrapper --
	authHandler := &handlers.AuthHandler{DB: pool}
	mux.HandleFunc("GET /auth/github/login", authHandler.GithubLogin)
	mux.HandleFunc("GET /auth/github/callback", authHandler.GithubCallback)

	// -- protected: everything else, wrapped in one auth middleware --
	protected := http.NewServeMux()
	registerRoutes(protected, pool)
	mux.Handle("/", auth.RequireAuth(protected))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

func registerRoutes(mux *http.ServeMux, pool *pgxpool.Pool) {
	suiteHandler := &handlers.SuiteHandler{DB: pool}
	rowsHandler := &handlers.RowsHandler{DB: pool}
	sharedHandler := &handlers.AccessHandler{DB: pool}

	// -- suites --
	mux.HandleFunc("POST /suites", suiteHandler.CreateSuite)
	mux.HandleFunc("GET /suites", suiteHandler.ListAllSuites)
	mux.HandleFunc("GET /suites/{id}", suiteHandler.GetSuiteByID)
	mux.HandleFunc("PATCH /suites/{id}", suiteHandler.UpdateSuiteByID)
	mux.HandleFunc("DELETE /suites/{id}", suiteHandler.DeleteSuiteByID)

	// -- rows --
	mux.HandleFunc("POST /tests/write-test", rowsHandler.CreateNewTestRow)
	mux.HandleFunc("POST /tests/import-bulk", rowsHandler.ImportBulkTestRows)
	mux.HandleFunc("GET /tests/{suite_id}", rowsHandler.ListAllTestRows)
	mux.HandleFunc("PATCH /tests/{row_id}", rowsHandler.UpdateRow)
	mux.HandleFunc("DELETE /tests/{row_id}", rowsHandler.DeleteTestRow)

	// -- AccessHandling --
	mux.HandleFunc("POST /access/provide", sharedHandler.ProvideAccessToUser)
	mux.HandleFunc("GET /access/list-users/{suite_id}", sharedHandler.ListAllUsersWithAccess)
	mux.HandleFunc("PATCH /access/update-access", sharedHandler.UpdateUserAccess)
	mux.HandleFunc("DELETE /access/remove-user", sharedHandler.RemoveUserAccess)
}
