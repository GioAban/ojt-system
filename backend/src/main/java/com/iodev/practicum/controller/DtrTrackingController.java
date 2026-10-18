package com.iodev.practicum.controller;

import com.iodev.practicum.dto.SectionTrackingDtos.*;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.MonthlyDtr;
import com.iodev.practicum.model.Semester;
import com.iodev.practicum.model.SignedDtr;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.MonthlyDtrRepository;
import com.iodev.practicum.repository.SemesterRepository;
import com.iodev.practicum.repository.SignedDtrRepository;
import com.iodev.practicum.repository.StudentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/coordinator/tracking/dtr")
public class DtrTrackingController {

    private static final List<String> MONTHS = List.of(
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December");

    private static final BigDecimal MAX_HOURS = new BigDecimal("744");

    @Autowired
    private CoordinatorRepository coordinatorRepository;

    @Autowired
    private MonthlyDtrRepository dtrRepository;

    @Autowired
    private SignedDtrRepository signedRepository;

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

        List<MonthlyDtr> dtrs = dtrRepository.findForTracking(coordinator.getId(), semesterId);
        List<Student> students = studentRepository.findForTracking(coordinator.getId(), semesterId);

        Map<String, BigDecimal> hoursByKey = new HashMap<>();
        if (!dtrs.isEmpty() && !students.isEmpty()) {
            List<Long> dtrIds = dtrs.stream().map(MonthlyDtr::getId).toList();
            for (Object[] row : signedRepository.findHours(dtrIds)) {
                if (row[2] != null) {
                    hoursByKey.put(row[0] + "-" + row[1], (BigDecimal) row[2]);
                }
            }
        }

        List<DtrColumn> months = dtrs.stream()
                .map(d -> new DtrColumn(d.getId(), d.getMonth(), d.getDueDate()))
                .toList();

        List<DtrStudentRow> rows = new ArrayList<>();
        for (Student s : students) {
            Map<Long, BigDecimal> hours = new LinkedHashMap<>();
            for (MonthlyDtr d : dtrs) {
                hours.put(d.getId(), hoursByKey.get(s.getId() + "-" + d.getId()));
            }
            String started = s.getStartTrainingDate() != null ? s.getStartTrainingDate() : s.getDeployedDate();
            rows.add(new DtrStudentRow(
                    s.getId(), s.getStudentNumber(), s.getFirstname(), s.getLastname(),
                    s.getMiddleInitial(), s.getSubjectCode(), started, s.getTrainingDuration(), hours));
        }

        return ResponseEntity.ok(new DtrTrackingResponse(semesterId, months, rows));
    }

    @PatchMapping("/hours")
    @Transactional
    public ResponseEntity<?> setHours(@RequestBody DtrHoursRequest request, Authentication authentication) {
        if (request == null || request.studentId() == null || request.dtrId() == null) {
            return ResponseEntity.badRequest().body("Student and month are required.");
        }

        BigDecimal hours = request.hours() == null ? null : request.hours().setScale(2, RoundingMode.HALF_UP);
        if (hours != null && (hours.signum() < 0 || hours.compareTo(MAX_HOURS) > 0)) {
            return ResponseEntity.badRequest().body("Hours must be between 0 and 744.");
        }

        Coordinator coordinator = coordinatorRepository.findByUserEmail(authentication.getName()).orElse(null);
        if (coordinator == null) {
            return ResponseEntity.status(403).body("Coordinator profile not found.");
        }

        Student student = studentRepository.findById(request.studentId()).orElse(null);
        MonthlyDtr dtr = dtrRepository.findById(request.dtrId()).orElse(null);
        if (student == null || dtr == null) {
            return ResponseEntity.notFound().build();
        }

        boolean ownsStudent = student.getCoordinator().getId().equals(coordinator.getId());
        boolean ownsDtr = dtr.getCoordinator().getId().equals(coordinator.getId());
        if (!ownsStudent || !ownsDtr) {
            return ResponseEntity.status(403).body("You can only update your own students' DTRs.");
        }
        if (!student.getSemester().getId().equals(dtr.getSemester().getId())) {
            return ResponseEntity.badRequest().body("That month doesn't belong to the student's semester.");
        }

        SignedDtr record = signedRepository
                .findFirstByStudentIdAndMonthlyDtrIdOrderByIdDesc(student.getId(), dtr.getId())
                .orElse(null);

        if (hours == null) {
            if (record != null) {
                record.setHours(null);
                record.setStatus(record.getFilePath() != null ? "For Checking" : "Assigned");
                signedRepository.save(record);
            }
        } else {
            if (record == null) {
                record = new SignedDtr();
                record.setMonthlyDtr(dtr);
                record.setStudent(student);
            }
            record.setHours(hours);
            record.setStatus("Checked");
            signedRepository.save(record);
        }

        BigDecimal total = signedRepository.totalHours(student.getId());
        if (total == null) {
            total = BigDecimal.ZERO;
        }
        total = total.setScale(2, RoundingMode.HALF_UP);

        student.setRenderedHours(total);
        studentRepository.save(student);

        return ResponseEntity.ok(new DtrHoursResult(hours, total));
    }

    @PostMapping("/months")
    @Transactional
    public ResponseEntity<?> addMonth(@RequestBody DtrMonthRequest request, Authentication authentication) {
        if (request == null || request.semesterId() == null) {
            return ResponseEntity.badRequest().body("Please select a semester.");
        }

        String raw = request.month() == null ? "" : request.month().trim();
        String month = MONTHS.stream().filter(m -> m.equalsIgnoreCase(raw)).findFirst().orElse(null);
        if (month == null) {
            return ResponseEntity.badRequest().body("Please select a valid month.");
        }

        Timestamp dueDate = null;
        if (request.dueDate() != null && !request.dueDate().isBlank()) {
            try {
                dueDate = Timestamp.valueOf(LocalDate.parse(request.dueDate()).atTime(23, 59));
            } catch (DateTimeParseException e) {
                return ResponseEntity.badRequest().body("Due date must look like 2026-03-05.");
            }
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

        if (dtrRepository.monthExists(coordinator.getId(), semester.getId(), month)) {
            return ResponseEntity.status(409).body(month + " already exists.");
        }

        MonthlyDtr dtr = new MonthlyDtr();
        dtr.setCoordinator(coordinator);
        dtr.setSemester(semester);
        dtr.setMonth(month);
        dtr.setDueDate(dueDate);
        dtr.setIsArchived(0);

        MonthlyDtr saved = dtrRepository.save(dtr);

        return ResponseEntity.ok(new DtrColumn(saved.getId(), saved.getMonth(), saved.getDueDate()));
    }

    @PatchMapping("/start-date")
    @Transactional
    public ResponseEntity<?> setStartDate(@RequestBody DtrStartDateRequest request,
                                        Authentication authentication) {
        if (request == null || request.studentId() == null) {
            return ResponseEntity.badRequest().body("Student is required.");
        }

        String raw = request.startDate() == null ? "" : request.startDate().trim();
        String stored = null;

        if (!raw.isEmpty()) {
            try {
                LocalDate date = LocalDate.parse(raw);
                if (date.getYear() < 2000 || date.getYear() > 2100) {
                    return ResponseEntity.badRequest().body("Please enter a year between 2000 and 2100.");
                }
                stored = date.toString();
            } catch (DateTimeParseException e) {
                return ResponseEntity.badRequest().body("Date must look like 2026-02-10.");
            }
        }

        Coordinator coordinator = coordinatorRepository.findByUserEmail(authentication.getName()).orElse(null);
        if (coordinator == null) {
            return ResponseEntity.status(403).body("Coordinator profile not found.");
        }

        Student student = studentRepository.findById(request.studentId()).orElse(null);
        if (student == null) {
            return ResponseEntity.notFound().build();
        }
        if (!student.getCoordinator().getId().equals(coordinator.getId())) {
            return ResponseEntity.status(403).body("You can only update your own students.");
        }

        student.setStartTrainingDate(stored);
        studentRepository.save(student);

        String shown = stored != null ? stored : student.getDeployedDate();
        return ResponseEntity.ok(new DtrStartDateResult(shown));
    }
}