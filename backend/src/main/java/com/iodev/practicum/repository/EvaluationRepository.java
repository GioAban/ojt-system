package com.iodev.practicum.repository;
import com.iodev.practicum.model.Evaluation;
import org.springframework.data.jpa.repository.JpaRepository;
public interface EvaluationRepository extends JpaRepository<Evaluation, Long> {}