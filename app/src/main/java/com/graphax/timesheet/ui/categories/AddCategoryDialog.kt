package com.graphax.timesheet.ui.categories

import android.app.Dialog
import android.os.Bundle
import android.view.LayoutInflater
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.DialogFragment
import com.graphax.timesheet.data.model.Category
import com.graphax.timesheet.databinding.DialogAddCategoryBinding

class AddCategoryDialog(
    private val existing: Category?,
    private val onSave: (name: String, colorHex: String) -> Unit
) : DialogFragment() {

    private val colors = listOf(
        "#F44336", "#E91E63", "#9C27B0", "#3F51B5",
        "#2196F3", "#009688", "#4CAF50", "#FF9800",
        "#795548", "#607D8B"
    )
    private var selectedColor = colors[0]

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        val b = DialogAddCategoryBinding.inflate(LayoutInflater.from(requireContext()))

        existing?.let {
            b.etName.setText(it.name)
            selectedColor = it.colorHex
        }

        val colorAdapter = ColorPickerAdapter(colors, selectedColor) { color ->
            selectedColor = color
            b.viewSelectedColor.setBackgroundColor(android.graphics.Color.parseColor(color))
        }
        b.rvColors.adapter = colorAdapter
        b.viewSelectedColor.setBackgroundColor(android.graphics.Color.parseColor(selectedColor))

        return AlertDialog.Builder(requireContext())
            .setTitle(if (existing == null) "Add Category" else "Edit Category")
            .setView(b.root)
            .setPositiveButton("Save") { _, _ ->
                val name = b.etName.text.toString().trim()
                if (name.isNotEmpty()) onSave(name, selectedColor)
            }
            .setNegativeButton("Cancel", null)
            .create()
    }
}
