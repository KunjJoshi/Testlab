package tools

import (
	"context"
	"fmt"

	"github.com/KunjJoshi/testlab-mcp/internal/client"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func RegisterListEnvironmentTool(s *server.MCPServer, c *client.Client) {
	tool := mcp.NewTool("list-environments",
		mcp.WithDescription("This tool allows to view all registered environments for the user. Note this tool allows viewing environments for any registered user and is not restricted by Auth"),
		mcp.WithInteger("user_id", mcp.Required(), mcp.Description("User whose environments need to be listed")),
	)

	handler := newListEnvironmentsHandler(c)
	s.AddTool(tool, handler.Handle)
}

type listEnvironmentsHandler struct {
	client *client.Client
}

func newListEnvironmentsHandler(c *client.Client) *listEnvironmentsHandler {
	return &listEnvironmentsHandler{client: c}
}

func (h *listEnvironmentsHandler) Handle(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, err := req.RequireInt("user_id")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	resp, err := h.client.Get(ctx, fmt.Sprintf("/environments/%d", userID))
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return mcp.NewToolResultText(string(resp)), nil
}
