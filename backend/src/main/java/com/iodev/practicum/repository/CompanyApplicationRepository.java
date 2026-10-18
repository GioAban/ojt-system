package com.iodev.practicum.repository;

import com.iodev.practicum.model.CompanyApplication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface CompanyApplicationRepository extends JpaRepository<CompanyApplication, Long> {

    List<CompanyApplication> findByStudentIdOrderByCreatedAtDesc(Long studentId);

    long countByStudentIdAndStatus(Long studentId, String status);

    boolean existsByStudentIdAndDepartmentIdAndStatus(Long studentId, Long departmentId, String status);

    List<CompanyApplication> findByStudentIdAndStatus(Long studentId, String status);

    @Query("select a from CompanyApplication a where a.studentId in "
            + "(select s.id from Student s where s.coordinator.id = :coordinatorId and s.semester.id = :semesterId) "
            + "order by case when a.status = 'PENDING' then 0 else 1 end, a.createdAt desc")
    List<CompanyApplication> findForCoordinator(@Param("coordinatorId") Long coordinatorId,
                                                @Param("semesterId") Long semesterId);

    @Query("select count(a) from CompanyApplication a where a.status = 'PENDING' and a.studentId in "
            + "(select s.id from Student s where s.coordinator.id = :coordinatorId and s.semester.id = :semesterId)")
    long countPending(@Param("coordinatorId") Long coordinatorId, @Param("semesterId") Long semesterId);
}
