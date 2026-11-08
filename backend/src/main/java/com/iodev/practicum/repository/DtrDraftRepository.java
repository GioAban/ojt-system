package com.iodev.practicum.repository;

import com.iodev.practicum.model.DtrDraft;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface DtrDraftRepository extends JpaRepository<DtrDraft, Long> {
    Optional<DtrDraft> findByStudentIdAndMonthlyDtrId(Long studentId, Long monthlyDtrId);

    /** student id, pinakahuling pag-save ng draft */
    @Query("select d.studentId, max(d.updatedAt) from DtrDraft d where d.studentId in :studentIds group by d.studentId")
    List<Object[]> lastSaved(@Param("studentIds") Collection<Long> studentIds);
}
