package com.iodev.practicum.repository;

import com.iodev.practicum.model.StudentDepartmentHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StudentDepartmentHistoryRepository extends JpaRepository<StudentDepartmentHistory, Long> {

    List<StudentDepartmentHistory> findByStudentIdAndEndedAtIsNull(Long studentId);

    long countByStudentId(Long studentId);

    Optional<StudentDepartmentHistory> findFirstByStudentIdAndDepartmentIdOrderByIdDesc(
            Long studentId, Long departmentId);
}