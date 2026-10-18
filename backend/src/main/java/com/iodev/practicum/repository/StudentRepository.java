package com.iodev.practicum.repository;

import com.iodev.practicum.model.Student;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface StudentRepository extends JpaRepository<Student, Long> {
    Optional<Student> findByEmail(String email);

    boolean existsByEmail(String email);

    @Query("select s.coordinator.id, count(s) from Student s where s.isArchived = false group by s.coordinator.id")
    List<Object[]> countActiveByCoordinator();

    @Query("select count(s) from Student s where s.coordinator.id = :coordinatorId and s.isArchived = false")
    long countActiveByCoordinatorId(@Param("coordinatorId") Long coordinatorId);

    @Query("select s from Student s left join fetch s.department d left join fetch d.company "
            + "where s.coordinator.id = :coordinatorId and s.semester.id = :semesterId and s.isArchived = false "
            + "order by s.lastname, s.firstname")
    List<Student> findForTracking(@Param("coordinatorId") Long coordinatorId,
                                  @Param("semesterId") Long semesterId);

    @Query("select s.department.id, count(s) from Student s "
            + "where s.department.id in :departmentIds and s.isArchived = false group by s.department.id")
    List<Object[]> countByDepartmentIds(@Param("departmentIds") Collection<Long> departmentIds);
}