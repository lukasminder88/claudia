package com.graphax.timesheet.ui

import android.app.Application
import androidx.lifecycle.*
import com.graphax.timesheet.data.db.TimesheetDatabase
import com.graphax.timesheet.data.model.Category
import com.graphax.timesheet.data.model.TimeEntryWithCategory
import com.graphax.timesheet.data.repository.TimesheetRepository
import com.graphax.timesheet.service.TimerService
import kotlinx.coroutines.launch

class TimerViewModel(app: Application) : AndroidViewModel(app) {
    private val repository: TimesheetRepository

    val categories: LiveData<List<Category>>
    val activeEntry: LiveData<TimeEntryWithCategory?>

    init {
        val db = TimesheetDatabase.getInstance(app)
        repository = TimesheetRepository(db.categoryDao(), db.timeEntryDao())
        categories = repository.allCategories.asLiveData()
        activeEntry = repository.activeEntry.asLiveData()
    }

    fun startTimer(category: Category) {
        TimerService.start(getApplication(), category.id)
    }

    fun stopTimer() {
        TimerService.stop(getApplication())
    }
}
