package com.iodev.practicum.dto;

public class TrackingStatusRequest {
    private Long studentId;
    private Long requirementId;
    private String status;

    public Long getStudentId() { return studentId; }
    public void setStudentId(Long studentId) { this.studentId = studentId; }

    public Long getRequirementId() { return requirementId; }
    public void setRequirementId(Long requirementId) { this.requirementId = requirementId; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}