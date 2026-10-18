package com.iodev.practicum.repository;

import com.iodev.practicum.model.Coordinator;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CoordinatorRepository extends JpaRepository<Coordinator, Long> {

    Optional<Coordinator> findByUserId(Long userId);

    Optional<Coordinator> findByUserEmail(String email);

    boolean existsByEmployeeNumberIgnoreCase(String employeeNumber);

    boolean existsByEmployeeNumberIgnoreCaseAndIdNot(String employeeNumber, Long id);

    @Query("select c.program.id, count(c) from Coordinator c where c.user.isArchived = false group by c.program.id")
    List<Object[]> countActiveByProgram();

    @Query("select count(c) from Coordinator c where c.program.id = :programId and c.user.isArchived = false")
    long countActiveByProgramId(@Param("programId") Long programId);
}