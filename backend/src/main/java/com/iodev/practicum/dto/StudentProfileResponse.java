package com.iodev.practicum.dto;

import java.math.BigDecimal;

public class StudentProfileResponse {
    private Long id;
    private String studentNumber;
    private String firstname;
    private String lastname;
    private String middleInitial;
    private String email;
    private String gender;
    private String contact;
    private String year;
    private String subjectCode;
    private String status;
    private String deployedDate;
    private String startTrainingDate;
    private String completedDate;
    private BigDecimal renderedHours;
    private BigDecimal trainingDuration;
    private String semester;
    private String coordinatorName;
    private String companyName;
    private String departmentName;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getStudentNumber() { return studentNumber; }
    public void setStudentNumber(String studentNumber) { this.studentNumber = studentNumber; }
    public String getFirstname() { return firstname; }
    public void setFirstname(String firstname) { this.firstname = firstname; }
    public String getLastname() { return lastname; }
    public void setLastname(String lastname) { this.lastname = lastname; }
    public String getMiddleInitial() { return middleInitial; }
    public void setMiddleInitial(String middleInitial) { this.middleInitial = middleInitial; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }
    public String getContact() { return contact; }
    public void setContact(String contact) { this.contact = contact; }
    public String getYear() { return year; }
    public void setYear(String year) { this.year = year; }
    public String getSubjectCode() { return subjectCode; }
    public void setSubjectCode(String subjectCode) { this.subjectCode = subjectCode; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getDeployedDate() { return deployedDate; }
    public void setDeployedDate(String deployedDate) { this.deployedDate = deployedDate; }
    public String getStartTrainingDate() { return startTrainingDate; }
    public void setStartTrainingDate(String startTrainingDate) { this.startTrainingDate = startTrainingDate; }
    public String getCompletedDate() { return completedDate; }
    public void setCompletedDate(String completedDate) { this.completedDate = completedDate; }
    public BigDecimal getRenderedHours() { return renderedHours; }
    public void setRenderedHours(BigDecimal renderedHours) { this.renderedHours = renderedHours; }
    public BigDecimal getTrainingDuration() { return trainingDuration; }
    public void setTrainingDuration(BigDecimal trainingDuration) { this.trainingDuration = trainingDuration; }
    public String getSemester() { return semester; }
    public void setSemester(String semester) { this.semester = semester; }
    public String getCoordinatorName() { return coordinatorName; }
    public void setCoordinatorName(String coordinatorName) { this.coordinatorName = coordinatorName; }
    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }
    public String getDepartmentName() { return departmentName; }
    public void setDepartmentName(String departmentName) { this.departmentName = departmentName; }
}