package com.iodev.practicum.repository;
import com.iodev.practicum.model.Evaluation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface EvaluationRepository extends JpaRepository<Evaluation, Long> {

    @Query("select e from Evaluation e where e.requirement.id = :requirementId")
    Optional<Evaluation> findByRequirementId(@Param("requirementId") Long requirementId);
}
