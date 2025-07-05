let dataBarang = [];

document.getElementById("excelFile").addEventListener("change", handleFileUpload);

function handleFileUpload(e) {
  const file = e.target.files[0];
  const reader = new FileReader();

  reader.onload = function (e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    dataBarang = jsonData.slice(1).map(row => ({
      nama: row[0],
      masuk: parseInt(row[1]),
      permintaan: parseInt(row[2]),
      harga: parseFloat(row[3]),
      simpan: parseFloat(row[4]),
      pesan: parseFloat(row[5])
    }));

    alert("Data dari Excel berhasil diimpor!");
  };

  reader.readAsArrayBuffer(file);
}

function importData() {
  const input = document.getElementById("excelInput").value.trim();
  const rows = input.split("\n").map(r => r.split("\t"));
  dataBarang = rows.map(row => ({
    nama: row[0],
    masuk: parseInt(row[1]),
    permintaan: parseInt(row[2]),
    harga: parseFloat(row[3]),
    simpan: parseFloat(row[4]),
    pesan: parseFloat(row[5])
  }));
  alert("Data berhasil diproses!");
}

function calculateInventory() {
  const bufferPercent = parseFloat(document.getElementById("bufferPercent").value) / 100;
  dataBarang.forEach(item => {
    item.buffer = item.permintaan * bufferPercent;
    item.kekurangan = Math.max(0, item.permintaan + item.buffer - item.masuk);
    item.nilai = item.harga * item.permintaan;
  });

  // ABC Analysis otomatis
  const sorted = [...dataBarang].sort((a, b) => b.nilai - a.nilai);
  // ABC otomatis (80/20)
  const totalNilai = sorted.reduce((sum, item) => sum + item.nilai, 0);
  let akumulasi = 0;

  sorted.forEach(item => {
    akumulasi += item.nilai;
    const persentase = akumulasi / totalNilai;

    if (persentase <= 0.8) {
      item.kategori = "A";
    } else if (persentase <= 0.95) {
      item.kategori = "B";
    } else {
      item.kategori = "C";
    }
  });


  let html = "<h2>Hasil Perhitungan</h2><table><tr><th>Barang</th><th>Masuk</th><th>Permintaan</th><th>Harga</th><th>Simpan</th><th>Pesan</th><th>Buffer</th><th>Kekurangan</th><th>ABC</th></tr>";
  sorted.forEach(i => {
    html += `<tr><td>${i.nama}</td><td>${i.masuk}</td><td>${i.permintaan}</td><td>${i.harga}</td><td>${i.simpan}</td><td>${i.pesan}</td><td>${i.buffer}</td><td>${i.kekurangan}</td><td>${i.kategori || "-"}</td></tr>`;
  });
  html += "</table>";

  // Wagner-Whitin untuk barang kategori A
  const itemA = sorted.find(i => i.kategori === "A");
  if (itemA) {
    const demand = Array(12).fill(itemA.permintaan); // simulasi 12 periode
    const result = wagnerWhitin(demand, itemA.pesan, itemA.simpan);

    html += "<h3>Kebijakan Wagner-Whitin</h3><table><tr><th>Order di Periode</th><th>Tutupi hingga</th></tr>";
    result.orders.forEach(o => {
      html += `<tr><td>${o.orderAt}</td><td>${o.coverTo}</td></tr>`;
    });
    html += `</table><p><strong>Total Biaya: </strong>Rp ${result.totalCost.toLocaleString()}</p>`;
  }

  document.getElementById("resultArea").innerHTML = html;

  // Grafik
  const ctx = document.getElementById('demandChart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dataBarang.map(i => i.nama),
      datasets: [
        { label: 'Permintaan', data: dataBarang.map(i => i.permintaan), backgroundColor: 'rgba(54, 162, 235, 0.6)' },
        { label: 'Buffer', data: dataBarang.map(i => i.buffer), backgroundColor: 'rgba(255, 206, 86, 0.6)' },
        { label: 'Kekurangan', data: dataBarang.map(i => i.kekurangan), backgroundColor: 'rgba(255, 99, 132, 0.6)' },
      ]
    }
  });
}

function wagnerWhitin(demand, orderCost, holdingCost) {
  const n = demand.length;
  const cost = new Array(n + 1).fill(Infinity);
  const policy = new Array(n + 1).fill(0);
  cost[0] = 0;

  for (let j = 1; j <= n; j++) {
    for (let i = 1; i <= j; i++) {
      let hold = 0;
      for (let k = i; k < j; k++) {
        hold += demand[k] * holdingCost * (j - k);
      }
      const total = cost[i - 1] + orderCost + hold;
      if (total < cost[j]) {
        cost[j] = total;
        policy[j] = i;
      }
    }
  }

  const orders = [];
  let j = n;
  while (j > 0) {
    const i = policy[j];
    orders.unshift({ orderAt: i, coverTo: j });
    j = i - 1;
  }

  return { orders, totalCost: cost[n] };
}

function exportToExcel() {
  let table = document.querySelector("table");
  if (!table) return alert("Belum ada data hasil.");
  let html = table.outerHTML.replace(/ /g, "%20");
  const link = document.createElement("a");
  link.href = 'data:application/vnd.ms-excel,' + html;
  link.download = "hasil_persediaan.xls";
  link.click();
}