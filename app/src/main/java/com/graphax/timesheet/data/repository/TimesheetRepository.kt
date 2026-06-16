package com.graphax.timesheet.data.repository

import com.graphax.timesheet.data.db.CategoryDao
import com.graphax.timesheet.data.db.TimeEntryDao
import com.graphax.timesheet.data.model.Category
import com.graphax.timesheet.data.model.TimeEntry
import com.graphax.timesheet.data.model.TimeEntryWithCategory
import kotlinx.coroutines.flow.Flow

class TimesheetRepository(
    private val categoryDao: CategoryDao,
    private val timeEntryDao: TimeEntryDao
) {
    val allCategories: Flow<List<Category>> = categoryDao.getAllCategories()
    val allEntriesWithCategory: Flow<List<TimeEntryWithCategory>> = timeEntryDao.getAllEntriesWithCategory()
    val activeEntry: Flow<TimeEntryWithCategory?> = timeEntryDao.getActiveEntry()

    suspend fun insertCategory(category: Category): Long = categoryDao.insert(category)
    suspend fun updateCategory(category: Category) = categoryDao.update(category)
    suspend fun deleteCategory(category: Category) = categoryDao.delete(category)
    suspend fun getCategoryById(id: Long): Category? = categoryDao.getById(id)

    suspend fun startTimer(categoryId: Long): Long =
        timeEntryDao.insert(TimeEntry(categoryId = categoryId, startTime = System.currentTimeMillis()))

    suspend fun stopTimer() {
        timeEntryDao.getActiveEntryRaw()?.let {
            timeEntryDao.update(it.copy(endTime = System.currentTimeMillis()))
        }
    }

    suspend fun getActiveEntryRaw() = timeEntryDao.getActiveEntrySuspend()

    suspend fun deleteEntry(entry: TimeEntry) = timeEntryDao.delete(entry)
    suspend fun deleteEntryById(id: Long) = timeEntryDao.deleteById(id)
}
