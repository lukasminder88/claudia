package com.graphax.timesheet.ui.timer

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import com.graphax.timesheet.data.model.Category
import com.graphax.timesheet.databinding.FragmentTimerBinding
import com.graphax.timesheet.ui.TimerViewModel
import com.graphax.timesheet.utils.FormatUtils

class TimerFragment : Fragment() {
    private var _binding: FragmentTimerBinding? = null
    private val binding get() = _binding!!
    private val viewModel: TimerViewModel by viewModels()

    private val handler = Handler(Looper.getMainLooper())
    private val tickRunnable = object : Runnable {
        override fun run() {
            updateElapsed()
            handler.postDelayed(this, 1000)
        }
    }

    private var selectedCategory: Category? = null
    private lateinit var categoryAdapter: TimerCategoryAdapter

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentTimerBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        categoryAdapter = TimerCategoryAdapter { category ->
            selectedCategory = category
            categoryAdapter.setSelected(category.id)
        }
        binding.rvCategories.adapter = categoryAdapter

        viewModel.categories.observe(viewLifecycleOwner) { cats ->
            categoryAdapter.submitList(cats)
        }

        viewModel.activeEntry.observe(viewLifecycleOwner) { active ->
            if (active != null) {
                binding.btnStartStop.text = "Stop"
                binding.btnStartStop.setBackgroundColor(resources.getColor(android.R.color.holo_red_dark, null))
                binding.tvActiveCategory.text = active.category.name
                binding.tvActiveCategory.visibility = View.VISIBLE
                selectedCategory = active.category
                categoryAdapter.setSelected(active.category.id)
                startTicking()
            } else {
                binding.btnStartStop.text = "Start"
                binding.btnStartStop.setBackgroundColor(resources.getColor(android.R.color.holo_green_dark, null))
                binding.tvActiveCategory.visibility = View.GONE
                binding.tvElapsed.text = "00:00:00"
                stopTicking()
            }
        }

        binding.btnStartStop.setOnClickListener {
            val active = viewModel.activeEntry.value
            if (active != null) {
                viewModel.stopTimer()
            } else {
                selectedCategory?.let { viewModel.startTimer(it) }
                    ?: run { binding.tvActiveCategory.text = "Select a category first"; binding.tvActiveCategory.visibility = View.VISIBLE }
            }
        }
    }

    private fun updateElapsed() {
        val active = viewModel.activeEntry.value ?: return
        val elapsed = System.currentTimeMillis() - active.entry.startTime
        binding.tvElapsed.text = FormatUtils.formatDuration(elapsed)
    }

    private fun startTicking() {
        handler.removeCallbacks(tickRunnable)
        handler.post(tickRunnable)
    }

    private fun stopTicking() {
        handler.removeCallbacks(tickRunnable)
    }

    override fun onDestroyView() {
        stopTicking()
        _binding = null
        super.onDestroyView()
    }
}
