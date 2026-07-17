<template>
  <div class="max-w-7xl mx-auto px-4 py-6 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Token Usage</h1>
      <div class="flex gap-2">
        <button
          v-for="d in [7, 30, 90]"
          :key="d"
          @click="days = d"
          :class="[
            'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
            days === d
              ? 'bg-violet-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          ]"
        >
          {{ d }} วัน
        </button>
      </div>
    </div>

    <!-- Summary Cards -->
    <div v-if="data" class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">จำนวนการเรียกใช้</p>
        <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ data.summary.totalCalls.toLocaleString() }}</p>
        <p class="text-xs text-gray-400 mt-1">ครั้ง</p>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Token Input รวม</p>
        <p class="text-2xl font-bold text-blue-600 dark:text-blue-400">{{ formatNumber(data.summary.totalTokensIn) }}</p>
        <p class="text-xs text-gray-400 mt-1">tokens</p>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Token Output รวม</p>
        <p class="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{{ formatNumber(data.summary.totalTokensOut) }}</p>
        <p class="text-xs text-gray-400 mt-1">tokens</p>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">ค่าใช้จ่ายโดยประมาณ</p>
        <p class="text-2xl font-bold text-amber-600 dark:text-amber-400">{{ data.summary.totalCostTHB.toFixed(2) }}</p>
        <p class="text-xs text-gray-400 mt-1">บาท (THB)</p>
      </div>
    </div>

    <!-- By Endpoint -->
    <div v-if="data && data.byEndpoint.length > 0" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div class="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
        <h2 class="font-semibold text-gray-800 dark:text-gray-200">สรุปแยกตาม Endpoint</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-750">
              <th class="px-4 py-3 text-left font-medium">Endpoint</th>
              <th class="px-4 py-3 text-right font-medium">จำนวนครั้ง</th>
              <th class="px-4 py-3 text-right font-medium">Token In</th>
              <th class="px-4 py-3 text-right font-medium">Token Out</th>
              <th class="px-4 py-3 text-right font-medium">ค่าใช้จ่าย (THB)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr v-for="ep in data.byEndpoint" :key="ep.endpoint" class="hover:bg-gray-50 dark:hover:bg-gray-750">
              <td class="px-4 py-3 font-medium text-gray-900 dark:text-white">{{ ep.label }}</td>
              <td class="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{{ ep.calls.toLocaleString() }}</td>
              <td class="px-4 py-3 text-right text-blue-600 dark:text-blue-400">{{ formatNumber(ep.tokensIn) }}</td>
              <td class="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">{{ formatNumber(ep.tokensOut) }}</td>
              <td class="px-4 py-3 text-right text-amber-600 dark:text-amber-400 font-medium">{{ ep.costTHB.toFixed(4) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Recent Calls -->
    <div v-if="data && data.recent.length > 0" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div class="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
        <h2 class="font-semibold text-gray-800 dark:text-gray-200">รายการล่าสุด (100 รายการ)</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-750">
              <th class="px-4 py-3 text-left font-medium">เวลา</th>
              <th class="px-4 py-3 text-left font-medium">Endpoint</th>
              <th class="px-4 py-3 text-left font-medium">Model</th>
              <th class="px-4 py-3 text-right font-medium">Token In</th>
              <th class="px-4 py-3 text-right font-medium">Token Out</th>
              <th class="px-4 py-3 text-right font-medium">รอบ</th>
              <th class="px-4 py-3 text-right font-medium">เวลา (ms)</th>
              <th class="px-4 py-3 text-right font-medium">ราคา (THB)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr v-for="r in data.recent" :key="r.id" class="hover:bg-gray-50 dark:hover:bg-gray-750">
              <td class="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ formatDate(r.createdAt) }}</td>
              <td class="px-4 py-2.5 text-gray-800 dark:text-gray-200">{{ r.label }}</td>
              <td class="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">{{ shortModel(r.modelUsed) }}</td>
              <td class="px-4 py-2.5 text-right text-blue-600 dark:text-blue-400">{{ r.tokensIn.toLocaleString() }}</td>
              <td class="px-4 py-2.5 text-right text-emerald-600 dark:text-emerald-400">{{ r.tokensOut.toLocaleString() }}</td>
              <td class="px-4 py-2.5 text-right text-gray-500 dark:text-gray-400">{{ r.iterations }}</td>
              <td class="px-4 py-2.5 text-right text-gray-500 dark:text-gray-400">{{ r.durationMs ?? '-' }}</td>
              <td class="px-4 py-2.5 text-right text-amber-600 dark:text-amber-400">{{ r.costTHB.toFixed(4) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Empty -->
    <div v-if="data && data.summary.totalCalls === 0" class="text-center py-16 text-gray-400 dark:text-gray-500">
      <p class="text-lg">ยังไม่มีข้อมูลใน {{ days }} วันที่ผ่านมา</p>
    </div>

    <!-- Loading -->
    <div v-if="pending" class="flex justify-center py-16">
      <div class="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const days = ref(30)

const { data, pending, refresh } = useFetch('/api/admin/token-usage', {
  query: computed(() => ({ days: days.value })),
  watch: [days],
})

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

function formatDate(d: string | Date | null): string {
  if (!d) return '-'
  return new Date(d).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
}

function shortModel(m: string | null | undefined): string {
  if (!m) return '-'
  return m.replace('gemini-', '').replace('-preview', '')
}
</script>
