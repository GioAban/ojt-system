package com.iodev.practicum.service;

import com.iodev.practicum.model.Student;
import com.iodev.practicum.model.StudentDepartmentHistory;
import com.iodev.practicum.repository.StudentDepartmentHistoryRepository;
import com.iodev.practicum.repository.StudentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;

/**
 * Pagtatapos ng OJT ng isang student (Complete OJT sa Students page) at ang pagwawasto ng petsa nito
 * mula sa report. Iisang pagsusuri ng petsa para sa dalawa.
 */
@Service
public class OjtCompletionService {

    @Autowired private StudentRepository studentRepository;
    @Autowired private StudentDepartmentHistoryRepository historyRepository;

    /** Sinusuri ang petsa ng pagtatapos; ibinabalik ang petsa o naghahagis ng ActionException */
    public LocalDate checkDate(Student student, String raw) {
        String value = raw == null ? "" : raw.trim();
        if (value.isEmpty()) throw ActionException.bad("Please enter the completion date.");

        LocalDate completed;
        try {
            completed = LocalDate.parse(value);
        } catch (DateTimeParseException e) {
            throw ActionException.bad("Date must look like 2026-04-30.");
        }
        if (completed.isAfter(LocalDate.now())) throw ActionException.bad("The completion date can't be in the future.");
        if (completed.getYear() < 2000) throw ActionException.bad("Please enter a valid completion date.");

        if (student.getDepartment() == null) {
            throw ActionException.bad("Assign the student to a company before completing the OJT.");
        }

        String startRaw = student.getStartTrainingDate() != null && !student.getStartTrainingDate().isBlank()
                ? student.getStartTrainingDate()
                : student.getDeployedDate();
        if (startRaw != null && startRaw.length() >= 10) {
            try {
                LocalDate start = LocalDate.parse(startRaw.substring(0, 10));
                if (completed.isBefore(start)) {
                    throw ActionException.bad("The completion date can't be earlier than the start date (" + start + ").");
                }
            } catch (DateTimeParseException ignored) {
                // hindi mabasa ang start date, laktawan ang pagsusuri
            }
        }
        return completed;
    }

    /** Complete OJT: status Completed, petsa, at isinasara ang bukas na placement */
    public void complete(Student student, LocalDate completed) {
        student.setStatus("Completed");
        student.setCompletedDate(completed.toString());
        studentRepository.save(student);

        Timestamp end = Timestamp.valueOf(completed.atStartOfDay());
        List<StudentDepartmentHistory> open = historyRepository.findByStudentIdAndEndedAtIsNull(student.getId());
        for (StudentDepartmentHistory h : open) {
            h.setEndedAt(h.getStartedAt() != null && end.before(h.getStartedAt()) ? h.getStartedAt() : end);
        }
        historyRepository.saveAll(open);
    }

    /**
     * Mula sa report: ang petsa lang ng tapos nang OJT ang naiwawasto (hindi nito tinatapos ang OJT ng iba).
     * Parehong pagsusuri ng petsa gaya ng Complete OJT.
     */
    public PreparedChange checkCompletedDateFromReport(Student student, String raw) {
        if (!"Completed".equalsIgnoreCase(student.getStatus())) {
            throw ActionException.bad("Only a completed OJT has an end date. Use Complete OJT on the Students page.");
        }
        LocalDate completed = checkDate(student, raw);
        String old = student.getCompletedDate() == null ? "" : student.getCompletedDate().trim();
        String next = completed.toString();
        if (old.startsWith(next)) return new PreparedChange("End of training", old, next, 1, null);
        return new PreparedChange("End of training", old, next, 1, () -> {
            student.setCompletedDate(next);
            studentRepository.save(student);
            // Iniaayon din ang pagsara ng huling placement sa bagong petsa
            Timestamp end = Timestamp.valueOf(completed.atStartOfDay());
            if (student.getDepartment() != null) {
                historyRepository.findFirstByStudentIdAndDepartmentIdOrderByIdDesc(student.getId(), student.getDepartment().getId())
                        .ifPresent(h -> {
                            if (h.getEndedAt() != null) {
                                h.setEndedAt(h.getStartedAt() != null && end.before(h.getStartedAt()) ? h.getStartedAt() : end);
                                historyRepository.save(h);
                            }
                        });
            }
        });
    }
}
