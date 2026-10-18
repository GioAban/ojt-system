package com.iodev.practicum.dto;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.util.List;
import java.util.Map;

public record TrackingResponse(
        Long semesterId,
        String type,
        List<RequirementColumn> requirements,
        List<StudentRow> students) {

    public record RequirementColumn(Long id, String title, Timestamp dueDate) {}

    public record StudentRow(
            Long id,
            String studentNumber,
            String firstname,
            String lastname,
            String middleInitial,
            String subjectCode,
            String moaStatus,
            String companyName,
            String departmentName,
            String status,
            String completedDate,
            String hiredDate,
            String jobRelated,
            String employabilityLevel,
            String predictedLevel,
            BigDecimal predictionConfidence,
            Timestamp predictedAt,
            Map<Long, String> statuses) {}
}