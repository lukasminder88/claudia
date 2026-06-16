package com.graphax.timesheet.ui

import android.app.Application
import androidx.lifecycle.*
import com.graphax.timesheet.data.db.TimesheetDatabase
import com.graphax.timesheet.data.model.Category
import com.graphax.timesheet.data.repository.TimesheetRepository
import kotlinx.coroutines.launch

class CategoriesViewModel(app: Application) : AndroidViewModel(app) {
    private val repository: TimesheetRepository

    val categories: LiveData<List<Category>>

    init {
        val db = TimesheetDatabase.getInstance(app)
        repository = TimesheetRepository(db.categoryDao(), db.timeEntryDao())
        categories = repository.allCategories.asLiveData()
    }

    fun addCategory(name: String, colorHex: String) = viewModelScope.launch {
        repository.insertCategory(Category(name = name, colorHex = colorHex))
    }

    fun updateCategory(category: Category) = viewModelScope.launch {
        repository.updateCategory(category)
    }

    fun deleteCategory(category: Category) = viewModelScope.launch {
        repository.deleteCategory(category)
    }
}
