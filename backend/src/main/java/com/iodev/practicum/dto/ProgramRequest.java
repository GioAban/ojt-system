package com.iodev.practicum.dto;

import java.math.BigDecimal;

public class ProgramRequest {
    private Long collegeId;
    private String name;
    private String abbreviation;
    private String programHead;
    private BigDecimal trainingDuration;

    public Long getCollegeId() { return collegeId; }
    public void setCollegeId(Long collegeId) { this.collegeId = collegeId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getAbbreviation() { return abbreviation; }
    public void setAbbreviation(String abbreviation) { this.abbreviation = abbreviation; }

    public String getProgramHead() { return programHead; }
    public void setProgramHead(String programHead) { this.programHead = programHead; }

    public BigDecimal getTrainingDuration() { return trainingDuration; }
    public void setTrainingDuration(BigDecimal trainingDuration) { this.trainingDuration = trainingDuration; }
}