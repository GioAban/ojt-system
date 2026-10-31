package com.iodev.practicum.repository;

import com.iodev.practicum.model.DtrDraft;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DtrDraftRepository extends JpaRepository<DtrDraft, Long> {
    Optional<DtrDraft> findByStudentIdAndMonthlyDtrId(Long studentId, Long monthlyDtrId);
}
