// DocumentRequirementFileRepository.java
package com.iodev.practicum.repository;
import com.iodev.practicum.model.DocumentRequirementFile;
import org.springframework.data.jpa.repository.JpaRepository;
public interface DocumentRequirementFileRepository extends JpaRepository<DocumentRequirementFile, Long> {}