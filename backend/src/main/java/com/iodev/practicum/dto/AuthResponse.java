package com.iodev.practicum.dto;

public class AuthResponse {
    private String token;
    private String email;
    private String fullname;
    private String role;
    private String coordinatorType;

    public AuthResponse(String token, String email, String fullname, String role, String coordinatorType) {
        this.token = token;
        this.email = email;
        this.fullname = fullname;
        this.role = role;
        this.coordinatorType = coordinatorType;
    }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getFullname() { return fullname; }
    public void setFullname(String fullname) { this.fullname = fullname; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getCoordinatorType() { return coordinatorType; }
    public void setCoordinatorType(String coordinatorType) { this.coordinatorType = coordinatorType; }
}