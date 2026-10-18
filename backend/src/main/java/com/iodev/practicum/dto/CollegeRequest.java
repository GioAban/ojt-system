package com.iodev.practicum.dto;

public class CollegeRequest {
    private String name;
    private String abbreviation;
    private String dean;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getAbbreviation() { return abbreviation; }
    public void setAbbreviation(String abbreviation) { this.abbreviation = abbreviation; }

    public String getDean() { return dean; }
    public void setDean(String dean) { this.dean = dean; }
}