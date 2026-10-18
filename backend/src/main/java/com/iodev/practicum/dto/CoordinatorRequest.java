package com.iodev.practicum.dto;

public class CoordinatorRequest {
    private String fullname;
    private String email;
    private String password;
    private Long programId;
    private String type;
    private String employeeNumber;
    private String professionalTitles;

    public String getFullname() { return fullname; }
    public void setFullname(String fullname) { this.fullname = fullname; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public Long getProgramId() { return programId; }
    public void setProgramId(Long programId) { this.programId = programId; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getEmployeeNumber() { return employeeNumber; }
    public void setEmployeeNumber(String employeeNumber) { this.employeeNumber = employeeNumber; }

    public String getProfessionalTitles() { return professionalTitles; }
    public void setProfessionalTitles(String professionalTitles) { this.professionalTitles = professionalTitles; }
}