package com.iodev.practicum.controller;

import com.iodev.practicum.dto.SectionTrackingDtos.*;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.MonthlyWeeklyReport;
import com.iodev.practicum.model.Semester;
import com.iodev.practicum.model.SignedWeeklyReport;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.MonthlyWeeklyReportRepository;
import com.iodev.practicum.repository.SemesterRepository;
import com.iodev.practicum.repository.SignedWeeklyReportRepository;
import com.iodev.practicum.repository.StudentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/coordinator/tracking/weekly")
public class WeeklyTrackingController {

    private static final Map<String, Integer> RATING_VALUES =
            Map.of("EXCELLENT", 4, "VERY_GOOD", 3, "GOOD", 2, "POOR", 1);
    private static final Map<Integer, String> RATING_NAMES =
            Map.of(4, "EXCELLENT", 3, "VERY_GOOD", 2, "GOOD", 1, "POOR");

    @Autowired
    private CoordinatorRepository coordinatorRepository;

    @Autowired
    private MonthlyWeeklyReportRepository reportRepository;

    @Autowired
    private SignedWeeklyReportRepository signedRepository;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private SemesterRepository semesterRepository;

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> get(@RequestParam Long semesterId, Authentication authentication) {
        Coordinator coordinator = coordinatorRepository.findByUserEmail(authentication.getName()).orElse(null);
        if (coordinator == null) {
            return ResponseEntity.status(403).body("Coordinator profile not found.");
        }

        List<MonthlyWeeklyReport> reports = reportRepository.findForTracking(coordinator.getId(), semesterId);
        List<Student> students = studentRepository.findForTracking(coordinator.getId(), semesterId);

        Map<String, String> ratingByKey = new HashMap<>();
        if (!reports.isEmpty() && !students.isEmpty()) {
            List<Long> reportIds = reports.stream().map(MonthlyWeeklyReport::getId).toList();
            for (Object[] row : signedRepository.findRatings(reportIds)) {
                String name = row[2] == null ? null : RATING_NAMES.get((Integer) row[2]);
                if (name != null) {
                    ratingByKey.put(row[0] + "-" + row[1], name);
                }
            }
        }

        List<WeeklyColumn> columns = reports.stream()
                .map(r -> new WeeklyColumn(
                        r.getId(), r.getMonthFrom().toLocalDate(), r.getMonthTo().toLocalDate(), r.getDueDate()))
                .toList();

        List<WeeklyStudentRow> rows = new ArrayList<>();
        for (Student s : students) {
            Map<Long, String> ratings = new LinkedHashMap<>();
            for (MonthlyWeeklyReport r : reports) {
                ratings.put(r.getId(), ratingByKey.getOrDefault(s.getId() + "-" + r.getId(), "NONE"));
            }
            rows.add(new WeeklyStudentRow(
                    s.getId(), s.getStudentNumber(), s.getFirstname(), s.getLastname(),
                    s.getMiddleInitial(), s.getSubjectCode(), ratings));
        }

        return ResponseEntity.ok(new WeeklyTrackingResponse(semesterId, columns, rows));
    }

    @PatchMapping("/rating")
    @Transactional
    public ResponseEntity<?> setRating(@RequestBody WeeklyRatingRequest request, Authentication authentication) {
        if (request == null || request.studentId() == null || request.reportId() == null) {
            return ResponseEntity.badRequest().body("Student and week are required.");
        }

        String key = request.rating() == null ? "" : request.rating().trim().toUpperCase();
        boolean clear = key.equals("NONE");
        Integer value = RATING_VALUES.get(key);
        if (!clear && value == null) {
            return ResponseEntity.badRequest().body("Rating must be EXCELLENT, VERY_GOOD, GOOD, POOR, or NONE.");
        }

        Coordinator coordinator = coordinatorRepository.findByUserEmail(authentication.getName()).orElse(null);
        if (coordinator == null) {
            return ResponseEntity.status(403).body("Coordinator profile not found.");
        }

        Student student = studentRepository.findById(request.studentId()).orElse(null);
        MonthlyWeeklyReport report = reportRepository.findById(request.reportId()).orElse(null);
        if (student == null || report == null) {
            return ResponseEntity.notFound().build();
        }

        boolean ownsStudent = student.getCoordinator().getId().equals(coordinator.getId());
        boolean ownsReport = report.getCoordinator().getId().equals(coordinator.getId());
        if (!ownsStudent || !ownsReport) {
            return ResponseEntity.status(403).body("You can only update your own students' reports.");
        }
        if (!student.getSemester().getId().equals(report.getSemester().getId())) {
            return ResponseEntity.badRequest().body("That week doesn't belong to the student's semester.");
        }

        SignedWeeklyReport record = signedRepository
                .findFirstByStudentIdAndMonthlyWeeklyReportIdOrderByIdDesc(student.getId(), report.getId())
                .orElse(null);

        if (clear) {
            if (record != null) {
                record.setSupervisorEvaluation(null);
                record.setSupervisorComment(null);
                record.setStatus(record.getFilePath() != null ? "For Checking" : "Assigned");
                signedRepository.save(record);
            }
            return ResponseEntity.ok(Map.of("rating", "NONE"));
        }

        if (record == null) {
            record = new SignedWeeklyReport();
            record.setMonthlyWeeklyReport(report);
            record.setStudent(student);
        }
        record.setSupervisorEvaluation(value);
        record.setStatus("Checked");
        signedRepository.save(record);

        return ResponseEntity.ok(Map.of("rating", key));
    }

    @PostMapping("/periods")
    @Transactional
    public ResponseEntity<?> addPeriod(@RequestBody WeeklyPeriodRequest request, Authentication authentication) {
        if (request == null || request.semesterId() == null) {
            return ResponseEntity.badRequest().body("Please select a semester.");
        }

        LocalDate from;
        LocalDate to;
        LocalDate due = null;
        try {
            from = LocalDate.parse(request.dateFrom());
            to = LocalDate.parse(request.dateTo());
            if (request.dueDate() != null && !request.dueDate().isBlank()) {
                due = LocalDate.parse(request.dueDate());
            }
        } catch (DateTimeParseException | NullPointerException e) {
            return ResponseEntity.badRequest().body("Please enter valid dates.");
        }

        if (to.isBefore(from)) {
            return ResponseEntity.badRequest().body("The end date can't be before the start date.");
        }
        if (ChronoUnit.DAYS.between(from, to) > 31) {
            return ResponseEntity.badRequest().body("A weekly report period can't be longer than 31 days.");
        }

        Coordinator coordinator = coordinatorRepository.findByUserEmail(authentication.getName()).orElse(null);
        if (coordinator == null) {
            return ResponseEntity.status(403).body("Coordinator profile not found.");
        }

        Semester semester = semesterRepository.findById(request.semesterId()).orElse(null);
        if (semester == null) {
            return ResponseEntity.badRequest().body("Selected semester was not found.");
        }
        if (Boolean.TRUE.equals(semester.getIsArchived())) {
            return ResponseEntity.badRequest().body("That semester is archived.");
        }

        java.sql.Date sqlFrom = java.sql.Date.valueOf(from);
        java.sql.Date sqlTo = java.sql.Date.valueOf(to);

        if (reportRepository.periodExists(coordinator.getId(), semester.getId(), sqlFrom, sqlTo)) {
            return ResponseEntity.status(409).body("That week already exists.");
        }

        MonthlyWeeklyReport report = new MonthlyWeeklyReport();
        report.setCoordinator(coordinator);
        report.setSemester(semester);
        report.setMonthFrom(sqlFrom);
        report.setMonthTo(sqlTo);
        report.setDueDate(due == null ? null : Timestamp.valueOf(due.atTime(23, 59)));
        report.setIsArchived(false);

        MonthlyWeeklyReport saved = reportRepository.save(report);

        return ResponseEntity.ok(new WeeklyColumn(saved.getId(), from, to, saved.getDueDate()));
    }
}