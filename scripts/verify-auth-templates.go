// Native Go HTML-template verification, including contextual URL escaping.
// Run: node (emit template JSON) | go run scripts/verify-auth-templates.go
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"html"
	"html/template"
	"os"
	"strings"
)

func main() {
	var templates map[string]string
	if err := json.NewDecoder(os.Stdin).Decode(&templates); err != nil {
		panic("Invalid template test input.")
	}
	const site = "https://fixture.replit.app"
	checked := 0
	for _, kind := range []string{"recovery", "invite"} {
		tpl, err := template.New(kind).Parse(templates[kind])
		if err != nil {
			panic(err)
		}
		for _, redirect := range []string{"", site, site + "/?staff-auth=recovery", site + "/?patient-auth=recovery"} {
			expected := redirect
			if expected == "" || expected == site {
				expected = site + "/?staff-auth=recovery"
			}
			expected += "&token_hash=fixture-otp&type=" + kind
			var output bytes.Buffer
			err := tpl.Execute(&output, map[string]any{
				"SiteURL": site, "RedirectTo": redirect, "TokenHash": "fixture-otp",
			})
			if err != nil {
				panic(err)
			}
			if !strings.Contains(html.UnescapeString(output.String()), `href="`+expected+`"`) {
				panic("Incorrect callback URL or HTML escaping.")
			}
			checked++
		}
	}
	fmt.Printf("{\"nativeGoTemplateCasesPassed\":%d}\n", checked)
}
