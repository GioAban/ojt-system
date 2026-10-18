package com.iodev.practicum.dto;

import java.math.BigDecimal;
import java.sql.Timestamp;

public class ProgramResponse {
    private final Long id;
    private final Long collegeId;
    private final String collegeName;
    private final String collegeAbbreviation;
    private final Boolean collegeArchived;
    private final String name;
    private final String abbreviation;
    private final BigDecimal trainingDuration;
    private final String programHead;
    private final Boolean isArchived;
    private final long coordinatorsCount;
    private final Timestamp createdAt;
    private final Timestamp updatedAt;

    public ProgramResponse(Long id, Long collegeId, String collegeName, String collegeAbbreviation,
                           Boolean collegeArchived, String name, String abbreviation,
                           BigDecimal trainingDuration, String programHead, Boolean isArchived,
                           long coordinatorsCount, Timestamp createdAt, Timestamp updatedAt) {
        this.id = id;
        this.collegeId = collegeId;
        this.collegeName = collegeName;
        this.collegeAbbreviation = collegeAbbreviation;
        this.collegeArchived = collegeArchived;
        this.name = name;
        this.abbreviation = abbreviation;
        this.trainingDuration = trainingDuration;
        this.programHead = programHead;
        this.isArchived = isArchived;
        this.coordinatorsCount = coordinatorsCount;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public Long getId() { return id; }
    public Long getCollegeId() { return collegeId; }
    public String getCollegeName() { return collegeName; }
    public String getCollegeAbbreviation() { return collegeAbbreviation; }
    public Boolean getCollegeArchived() { return collegeArchived; }
    public String getName() { return name; }
    public String getAbbreviation() { return abbreviation; }
    public BigDecimal getTrainingDuration() { return trainingDuration; }
    public String getProgramHead() { return programHead; }
    public Boolean getIsArchived() { return isArchived; }
    public long getCoordinatorsCount() { return coordinatorsCount; }
    public Timestamp getCreatedAt() { return createdAt; }
    public Timestamp getUpdatedAt() { return updatedAt; }
}