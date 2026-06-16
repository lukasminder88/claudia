package com.graphax.timesheet.ui.categories

import android.graphics.Color
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.graphax.timesheet.databinding.ItemColorBinding

class ColorPickerAdapter(
    private val colors: List<String>,
    private var selectedColor: String,
    private val onSelect: (String) -> Unit
) : RecyclerView.Adapter<ColorPickerAdapter.VH>() {

    inner class VH(private val b: ItemColorBinding) : RecyclerView.ViewHolder(b.root) {
        fun bind(color: String) {
            b.viewColor.setBackgroundColor(Color.parseColor(color))
            b.viewSelected.visibility = if (color == selectedColor) android.view.View.VISIBLE else android.view.View.GONE
            b.root.setOnClickListener {
                val old = colors.indexOf(selectedColor)
                selectedColor = color
                notifyItemChanged(old)
                notifyItemChanged(colors.indexOf(color))
                onSelect(color)
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(ItemColorBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(holder: VH, position: Int) = holder.bind(colors[position])
    override fun getItemCount() = colors.size
}
