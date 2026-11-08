package com.iodev.practicum.repository;
import com.iodev.practicum.model.SignedEvaluation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface SignedEvaluationRepository extends JpaRepository<SignedEvaluation, Long> {

    Optional<SignedEvaluation> findByEvaluationIdAndStudentId(Long evaluationId, Long studentId);

    /** student id, requirement id, percent: para sa mga report */
    @Query("select s.student.id, s.evaluation.requirement.id, s.normalizedScore from SignedEvaluation s "
            + "where s.evaluation.requirement.id in :requirementIds")
    List<Object[]> findForReports(@Param("requirementIds") Collection<Long> requirementIds);
}
