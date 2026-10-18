package com.iodev.practicum.dto;

import java.sql.Timestamp;

public class CollegeResponse {
    private final Long id;
    private final String name;
    private final String abbreviation;
    private final String dean;
    private final String logo;
    private final Boolean isArchived;
    private final long programsCount;
    private final Timestamp createdAt;
    private final Timestamp updatedAt;

    public CollegeResponse(Long id, String name, String abbreviation, String dean, String logo,
                           Boolean isArchived, long programsCount,
                           Timestamp createdAt, Timestamp updatedAt) {
        this.id = id;
        this.name = name;
        this.abbreviation = abbreviation;
        this.dean = dean;
        this.logo = logo;
        this.isArchived = isArchived;
        this.programsCount = programsCount;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getAbbreviation() { return abbreviation; }
    public String getDean() { return dean; }
    public String getLogo() { return logo; }
    public Boolean getIsArchived() { return isArchived; }
    public long getProgramsCount() { return programsCount; }
    public Timestamp getCreatedAt() { return createdAt; }
    public Timestamp getUpdatedAt() { return updatedAt; }
}