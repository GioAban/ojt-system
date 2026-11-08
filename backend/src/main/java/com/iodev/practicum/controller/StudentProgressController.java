package com.iodev.practicum.controller;

import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.StudentManagementRepository;
import com.iodev.practicum.repository.StudentRepository;
import com.iodev.practicum.service.StudentProgressService;
import com.iodev.practicum.service.StudentProgressService.Category;
import com.iodev.practicum.service.StudentProgressService.Snapshot;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.*;

/**
 * Progress ng student: ang sarili niyang detalye (/me) at ang buod ng mga kasabay niya (/class).
 * Ang pagkuwenta ay nasa StudentProgressService (parehong batayan ng Dashboard ng coordinator).
 */
@RestController
@RequestMapping("/api/student/progress")
public class StudentProgressController {

    public record Me(int overall, List<Category> categories) {}

    public record ClassRow(String label, boolean me, int overall, Map<String, Integer> categories) {}

    public record ClassData(int average, List<ClassRow> students) {}

    @Autowired private StudentManagementRepository studentManagementRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private StudentProgressService progress;

    @GetMapping("/me")
    @Transactional(readOnly = true)
    public ResponseEntity<?> me(Authentication authentication) {
        Student s = current(authentication);
        if (s == null) return ResponseEntity.status(403).body("Student account not found.");
        if (s.getCoordinator() == null || s.getSemester() == null) {
            return ResponseEntity.ok(new Me(0, List.of()));
        }
        Snapshot snap = progress.load(s.getCoordinator().getId(), s.getSemester().getId(), List.of(s));
        List<Category> categories = progress.categories(s, snap, true);
        return ResponseEntity.ok(new Me(StudentProgressService.overall(categories), categories));
    }

    @GetMapping("/class")
    @Transactional(readOnly = true)
    public ResponseEntity<?> classmates(Authentication authentication) {
        Student me = current(authentication);
        if (me == null) return ResponseEntity.status(403).body("Student account not found.");
        if (me.getCoordinator() == null || me.getSemester() == null) {
            return ResponseEntity.ok(new ClassData(0, List.of()));
        }
        Long coordinatorId = me.getCoordinator().getId();
        Long semesterId = me.getSemester().getId();

        List<Student> students = new ArrayList<>(studentRepository.findForTracking(coordinatorId, semesterId));
        if (students.stream().noneMatch(x -> x.getId().equals(me.getId()))) students.add(me);

        Snapshot snap = progress.load(coordinatorId, semesterId, students);

        List<ClassRow> others = new ArrayList<>();
        ClassRow mine = null;
        int sum = 0;
        for (Student s : students) {
            List<Category> categories = progress.categories(s, snap, false);

            Map<String, Integer> byKey = new LinkedHashMap<>();
            for (Category c : categories) byKey.put(c.key(), c.total() == 0 ? -1 : c.percent());
            int overall = StudentProgressService.overall(categories);
            sum += overall;

            boolean isMe = s.getId().equals(me.getId());
            ClassRow row = new ClassRow(isMe ? "You" : shortName(s), isMe, overall, byKey);
            if (isMe) mine = row;
            else others.add(row);
        }
        others.sort(Comparator.comparing(ClassRow::label, String.CASE_INSENSITIVE_ORDER));

        List<ClassRow> out = new ArrayList<>();
        if (mine != null) out.add(mine);
        out.addAll(others);
        return ResponseEntity.ok(new ClassData(students.isEmpty() ? 0 : Math.round((float) sum / students.size()), out));
    }

    private static String shortName(Student s) {
        String first = s.getFirstname() == null ? "" : s.getFirstname().trim();
        String last = s.getLastname() == null ? "" : s.getLastname().trim();
        return (first + (last.isEmpty() ? "" : " " + last.charAt(0) + ".")).trim();
    }

    private Student current(Authentication authentication) {
        if (authentication == null) return null;
        return studentManagementRepository.findByEmail(authentication.getName()).stream()
                .max(Comparator.comparing(Student::getId))
                .orElse(null);
    }
}
