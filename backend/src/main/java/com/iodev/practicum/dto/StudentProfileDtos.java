package com.iodev.practicum.dto;

import java.math.BigDecimal;
import java.util.List;

public final class StudentProfileDtos {

    private StudentProfileDtos() {}

    public record Profile(
            Long id, String studentNumber, String firstname, String lastname, String email,
            String status, String semester, String coordinatorName,
            String companyName, String departmentName,
            BigDecimal renderedHours, BigDecimal trainingDuration,
            boolean mustChangePassword) {}

    public record CompanyDepartment(Long id, String name, int slots, int filled) {}

    public record CompanyEntry(Long id, String name, String address, String location,
                               String contactNumber, String nature,
                               List<CompanyDepartment> departments) {}

    public record CompaniesResponse(String status, boolean canApply, List<CompanyEntry> companies) {}


    /** Isang card sa Home: requirement, weekly report o DTR. scope = requirement | weekly | dtr */
    public record WorkCard(String scope, Long id, String title, String subtitle, String type,
                           String instructions, String dueDate, String status, boolean hasWork) {}

    public record HomeResponse(String studentStatus, List<WorkCard> items) {}

    /** Isang file o link sa loob ng isang gawain */
    public record SubmissionItem(Long id, String kind, String name, String url, Long sizeBytes) {}

    /** Buong detalye ng isang gawain para sa student (parang assignment page ng Classroom) */
    public record WorkDetail(String scope, Long id, String title, String subtitle, String type,
                             String instructions, String dueDate, String status,
                             String templateName, String templateUrl,
                             boolean canEdit, boolean canTurnIn, boolean canUnsubmit,
                             boolean needsHours, java.math.BigDecimal hours,
                             List<SubmissionItem> items) {}

    public record LinkRequest(String url, String name) {}

    public record TurnInRequest(java.math.BigDecimal hours) {}

    public record CommentRequest(String body) {}

    public record CommentItem(Long id, String author, String authorName, String body, String createdAt, boolean mine) {}

    /** Isang abiso. link ay saan ito dadalhin sa app. */
    public record NotificationItem(String key, String type, String title, String message,
                                   String createdAt, boolean unread, String link) {}

    public record NotificationsResponse(int unread, List<NotificationItem> items) {}
}
