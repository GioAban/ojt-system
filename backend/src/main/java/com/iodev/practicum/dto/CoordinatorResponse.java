package com.iodev.practicum.dto;

import java.sql.Timestamp;

public class CoordinatorResponse {
    private final Long id;
    private final Long userId;
    private final String fullname;
    private final String email;
    private final Long programId;
    private final String programName;
    private final String programAbbreviation;
    private final Boolean programArchived;
    private final String collegeAbbreviation;
    private final String type;
    private final String employeeNumber;
    private final String professionalTitles;
    private final Boolean isArchived;
    private final long studentsCount;
    private final Timestamp createdAt;

    public CoordinatorResponse(Long id, Long userId, String fullname, String email,
                               Long programId, String programName, String programAbbreviation,
                               Boolean programArchived, String collegeAbbreviation, String type,
                               String employeeNumber, String professionalTitles,
                               Boolean isArchived, long studentsCount, Timestamp createdAt) {
        this.id = id;
        this.userId = userId;
        this.fullname = fullname;
        this.email = email;
        this.programId = programId;
        this.programName = programName;
        this.programAbbreviation = programAbbreviation;
        this.programArchived = programArchived;
        this.collegeAbbreviation = collegeAbbreviation;
        this.type = type;
        this.employeeNumber = employeeNumber;
        this.professionalTitles = professionalTitles;
        this.isArchived = isArchived;
        this.studentsCount = studentsCount;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public String getFullname() { return fullname; }
    public String getEmail() { return email; }
    public Long getProgramId() { return programId; }
    public String getProgramName() { return programName; }
    public String getProgramAbbreviation() { return programAbbreviation; }
    public Boolean getProgramArchived() { return programArchived; }
    public String getCollegeAbbreviation() { return collegeAbbreviation; }
    public String getType() { return type; }
    public String getEmployeeNumber() { return employeeNumber; }
    public String getProfessionalTitles() { return professionalTitles; }
    public Boolean getIsArchived() { return isArchived; }
    public long getStudentsCount() { return studentsCount; }
    public Timestamp getCreatedAt() { return createdAt; }
}