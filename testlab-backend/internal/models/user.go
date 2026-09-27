package models

type User struct {
	UserID    int64  `json:"user_id"`
	Username  string `json:"username"`
	Email     string `json:"email"`
	CreatedAt string `json:"created_at"`
}

type SharedSuites struct {
	SharingID   int64  `json:"sharing_id"`
	UserID      int64  `json:"user_id"`
	ProviderID  int64  `json:"provider_id"`
	SuiteID     int64  `json:"suite_id"`
	AccessScope string `json:"access_scope"`
}
