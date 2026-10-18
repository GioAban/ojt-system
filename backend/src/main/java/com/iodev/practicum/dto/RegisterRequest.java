package com.iodev.practicum.dto;

public class RegisterRequest {
    private Long programId;
    private String employeeNumber;
    private String professionalTitles;
    private String fullname;
    private String email;
    private String password;

    // Getters and Setters
    public Long getProgramId() { return programId; }
    public void setProgramId(Long programId) { this.programId = programId; }

    public String getEmployeeNumber() { return employeeNumber; }
    public void setEmployeeNumber(String employeeNumber) { this.employeeNumber = employeeNumber; }

    public String getProfessionalTitles() { return professionalTitles; }
    public void setProfessionalTitles(String professionalTitles) { this.professionalTitles = professionalTitles; }

    public String getFullname() { return fullname; }
    public void setFullname(String fullname) { this.fullname = fullname; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
}