package com.iodev.practicum.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public final class EvaluationDtos {

    private EvaluationDtos() {}

    /** Galing sa sistema, hindi nababago sa form */
    public record Info(String studentName, String course, String companyName, String companyAddress,
                       String department, String semester) {}

    public record CriterionScore(Long id, String category, String name, BigDecimal weight, BigDecimal score) {}

    public record Form(String key, Info info, List<CriterionScore> criteria,
                       String strongPoints, String needsImprovement, boolean discussed,
                       String supervisorName, String supervisorPosition, String date,
                       String periodFrom, String periodTo, String contactNo,
                       BigDecimal originalScore, BigDecimal normalizedScore,
                       String editedBy, String editedAt, boolean editable) {}

    public record FormUpdate(Map<Long, BigDecimal> scores,
                             String strongPoints, String needsImprovement, Boolean discussed,
                             String supervisorName, String supervisorPosition, String date,
                             String periodFrom, String periodTo, String contactNo) {}

    /** Para sa coordinator: ang form at ang signed copy */
    public record Review(Form form, String status, List<SubmissionDtos.SubmissionFileDto> files) {}
}
