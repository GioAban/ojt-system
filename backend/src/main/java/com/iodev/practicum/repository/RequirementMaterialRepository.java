package com.iodev.practicum.repository;

import com.iodev.practicum.model.RequirementMaterial;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RequirementMaterialRepository extends JpaRepository<RequirementMaterial, Long> {

    List<RequirementMaterial> findByRequirementIdOrderByIdAsc(Long requirementId);

    Optional<RequirementMaterial> findByIdAndRequirementId(Long id, Long requirementId);

    long countByRequirementId(Long requirementId);
}