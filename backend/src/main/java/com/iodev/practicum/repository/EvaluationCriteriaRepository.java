package com.iodev.practicum.repository;
import com.iodev.practicum.model.EvaluationCriteria;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface EvaluationCriteriaRepository extends JpaRepository<EvaluationCriteria, Long> {

    @Query("select c from EvaluationCriteria c where c.evaluation.id = :evaluationId and c.isArchived = false "
            + "order by c.sortOrder, c.id")
    List<EvaluationCriteria> findForForm(@Param("evaluationId") Long evaluationId);
}
