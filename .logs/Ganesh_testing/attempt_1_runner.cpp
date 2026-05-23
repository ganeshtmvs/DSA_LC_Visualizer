
#include <iostream>
#include <vector>
#include <stack>
#include <queue>
#include <deque>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <map>
#include <set>
#include <utility>
#include <algorithm>
#include <numeric>
#include <climits>
using namespace std;

// TreeNode definition matching LeetCode exactly
struct TreeNode {
    int val;
    TreeNode *left;
    TreeNode *right;
    TreeNode(int x) : val(x), left(NULL), right(NULL) {}
};

// ListNode definition matching LeetCode exactly
struct ListNode {
    int val;
    ListNode *next;
    ListNode(int x) : val(x), next(NULL) {}
};

// Global tracking
vector<int> global_nums;
vector<int> graph_node_vals;
int stepCount = 0;
bool heap_initialized = false;

void check_step_limit() {
    if (stepCount >= 1000) {
        cout << "{\"step\":" << stepCount << ",\"action\":\"finish\"}" << endl;
        cout << "]}" << endl;
        exit(0);
    }
}


template<typename T = int>
class VisualizerStack {
private:
    stack<T> s;
public:
    void push(const T& val) {
        s.push(val);
        stepCount++;
        check_step_limit();
        int idx = (int)val;
        int value = (idx >= 0 && idx < global_nums.size()) ? global_nums[idx] : -1;
        cout << "{\"step\":" << stepCount << ",\"action\":\"push_stack\",\"index\":" << idx << ",\"value\":" << value << "}," << endl;
    }
    void pop() {
        if (s.empty()) return;
        T val = s.top();
        s.pop();
        stepCount++;
        check_step_limit();
        int idx = (int)val;
        cout << "{\"step\":" << stepCount << ",\"action\":\"pop_stack\",\"index\":" << idx << "}," << endl;
    }
    T top() { return s.top(); }
    bool empty() { return s.empty(); }
    size_t size() { return s.size(); }
};

template<typename T = int>
class VisualizerQueue {
private:
    queue<T> q;
public:
    void push(const T& val) {
        q.push(val);
        stepCount++;
        check_step_limit();
        int idx = (int)val;
        int value = (idx >= 0 && idx < global_nums.size()) ? global_nums[idx] : -1;
        cout << "{\"step\":" << stepCount << ",\"action\":\"push_queue\",\"index\":" << idx << ",\"value\":" << value << "}," << endl;
    }
    void pop() {
        if (q.empty()) return;
        T val = q.front();
        q.pop();
        stepCount++;
        check_step_limit();
        int idx = (int)val;
        cout << "{\"step\":" << stepCount << ",\"action\":\"pop_queue\",\"index\":" << idx << "}," << endl;
    }
    T front() { return q.front(); }
    T back() { return q.back(); }
    bool empty() { return q.empty(); }
    size_t size() { return q.size(); }
};

template<typename T = int>
class VisualizerDeque {
private:
    deque<T> dq;
public:
    void push_back(const T& val) {
        dq.push_back(val);
        stepCount++;
        check_step_limit();
        int idx = (int)val;
        int value = (idx >= 0 && idx < global_nums.size()) ? global_nums[idx] : -1;
        cout << "{\"step\":" << stepCount << ",\"action\":\"push_back_deque\",\"index\":" << idx << ",\"value\":" << value << "}," << endl;
    }
    void push_front(const T& val) {
        dq.push_front(val);
        stepCount++;
        check_step_limit();
        int idx = (int)val;
        int value = (idx >= 0 && idx < global_nums.size()) ? global_nums[idx] : -1;
        cout << "{\"step\":" << stepCount << ",\"action\":\"push_front_deque\",\"index\":" << idx << ",\"value\":" << value << "}," << endl;
    }
    void pop_back() {
        if (dq.empty()) return;
        T val = dq.back();
        dq.pop_back();
        stepCount++;
        check_step_limit();
        int idx = (int)val;
        cout << "{\"step\":" << stepCount << ",\"action\":\"pop_back_deque\",\"index\":" << idx << "}," << endl;
    }
    void pop_front() {
        if (dq.empty()) return;
        T val = dq.front();
        dq.pop_front();
        stepCount++;
        check_step_limit();
        int idx = (int)val;
        cout << "{\"step\":" << stepCount << ",\"action\":\"pop_front_deque\",\"index\":" << idx << "}," << endl;
    }
    T front() { return dq.front(); }
    T back() { return dq.back(); }
    bool empty() { return dq.empty(); }
    size_t size() { return dq.size(); }
};

template<typename T = int, typename Container = vector<T>, typename Compare = less<T>>
class VisualizerPriorityQueue {
private:
    std::priority_queue<T, Container, Compare> pq;
    void logInit() {
        if (!heap_initialized) {
            heap_initialized = true;
            stepCount++;
        check_step_limit();
            cout << "{\"step\":" << stepCount << ",\"action\":\"init_heap\"}," << endl;
        }
    }
public:
    void push(const T& val) {
        logInit();
        pq.push(val);
        stepCount++;
        check_step_limit();
        int idx = (int)val;
        int value = (idx >= 0 && idx < (int)global_nums.size()) ? global_nums[idx] : idx;
        cout << "{\"step\":" << stepCount << ",\"action\":\"push_heap\",\"index\":" << idx << ",\"value\":" << value << "}," << endl;
    }
    void pop() {
        if (pq.empty()) return;
        T val = pq.top();
        pq.pop();
        stepCount++;
        check_step_limit();
        int idx = (int)val;
        cout << "{\"step\":" << stepCount << ",\"action\":\"pop_heap\",\"index\":" << idx << "}," << endl;
    }
    T top() { return pq.top(); }
    bool empty() { return pq.empty(); }
    size_t size() { return pq.size(); }
};

class VisualizerMap {
private:
    unordered_map<int, int> m;
    bool initialized = false;
    void ensureInit() {
        if (!initialized) {
            initialized = true;
            stepCount++;
        check_step_limit();
            cout << "{\"step\":" << stepCount << ",\"action\":\"init_map\"}," << endl;
        }
    }
public:
    void put(int key, int val) {
        ensureInit();
        m[key] = val;
        stepCount++;
        check_step_limit();
        cout << "{\"step\":" << stepCount << ",\"action\":\"map_put\",\"key\":" << key << ",\"val\":" << val << "}," << endl;
    }
    int get(int key) {
        ensureInit();
        int val = 0;
        auto it = m.find(key);
        if (it != m.end()) val = it->second;
        stepCount++;
        check_step_limit();
        cout << "{\"step\":" << stepCount << ",\"action\":\"map_get\",\"key\":" << key << ",\"val\":" << val << "}," << endl;
        return val;
    }
    void erase(int key) {
        ensureInit();
        m.erase(key);
        stepCount++;
        check_step_limit();
        cout << "{\"step\":" << stepCount << ",\"action\":\"map_erase\",\"key\":" << key << "}," << endl;
    }
    bool count(int key) { return m.count(key) > 0; }
    int& operator[](int key) {
        ensureInit();
        if (!m.count(key)) {
            m[key] = 0;
            stepCount++;
            check_step_limit();
            cout << "{\"step\":" << stepCount << ",\"action\":\"map_put\",\"key\":" << key << ",\"val\":0}," << endl;
        }
        return m[key];
    }
};

void graph_init(int n, const vector<int>& vals) {
    graph_node_vals = vals;
    if ((int)graph_node_vals.size() < n) {
        graph_node_vals.resize(n, 0);
    }
    stepCount++;
    check_step_limit();
    cout << "{\"step\":" << stepCount << ",\"action\":\"init_graph\",\"nodes\":" << n << "}," << endl;
}

void graph_add_edge(int u, int v) {
    stepCount++;
    check_step_limit();
    cout << "{\"step\":" << stepCount << ",\"action\":\"graph_edge\",\"u\":" << u << ",\"v\":" << v << "}," << endl;
}

void visit_graph_impl(int node, int line = 0) {
    stepCount++;
    check_step_limit();
    int val = (node >= 0 && node < (int)graph_node_vals.size()) ? graph_node_vals[node] : node;
    cout << "{\"step\":" << stepCount << ",\"action\":\"visit_graph_node\",\"node\":" << node << ",\"val\":" << val << ",\"line\":" << line << "}," << endl;
}

void focus_graph_edge_impl(int u, int v, int line = 0) {
    stepCount++;
    check_step_limit();
    cout << "{\"step\":" << stepCount << ",\"action\":\"focus_edge\",\"u\":" << u << ",\"v\":" << v << ",\"line\":" << line << "}," << endl;
}

void focus_pointer_impl(const string& label, int idx, int line = 0) {
    stepCount++;
    check_step_limit();
    int value = (idx >= 0 && idx < (int)global_nums.size()) ? global_nums[idx] : -1;
    cout << "{\"step\":" << stepCount << ",\"action\":\"focus_pointer\",\"label\":\"" << label << "\",\"index\":" << idx << ",\"value\":" << value << ",\"line\":" << line << "}," << endl;
}

void resolve_impl(int idx, int resolvedValue, int line = 0) {
    stepCount++;
    check_step_limit();
    cout << "{\"step\":" << stepCount << ",\"action\":\"resolve\",\"index\":" << idx << ",\"resolvedValue\":" << resolvedValue << ",\"line\":" << line << "}," << endl;
}

bool compare_impl(int idx1, int idx2, int line = 0) {
    stepCount++;
    check_step_limit();
    int val1 = global_nums[idx1];
    int val2 = global_nums[idx2];
    cout << "{\"step\":" << stepCount << ",\"action\":\"compare\",\"stackTopIndex\":" << idx1 << ",\"stackTopValue\":" << val1 << ",\"arrayIndex\":" << idx2 << ",\"arrayValue\":" << val2 << ",\"line\":" << line << "}," << endl;
    return val1 < val2;
}

void visit_impl(int val, int line = 0) {
    stepCount++;
    check_step_limit();
    cout << "{\"step\":" << stepCount << ",\"action\":\"focus_array\",\"index\":" << val << ",\"value\":" << (val >= 0 && val < (int)global_nums.size() ? global_nums[val] : -9999) << ",\"line\":" << line << "}," << endl;
}

// 2D Grid / Matrix SDK functions
void focus_cell_impl(int r, int c, int line = 0) {
    stepCount++;
    check_step_limit();
    cout << "{\"step\":" << stepCount << ",\"action\":\"focus_cell\",\"row\":" << r << ",\"col\":" << c << ",\"line\":" << line << "}," << endl;
}

void update_cell_impl(int r, int c, int val, int line = 0) {
    stepCount++;
    check_step_limit();
    cout << "{\"step\":" << stepCount << ",\"action\":\"update_cell\",\"row\":" << r << ",\"col\":" << c << ",\"val\":" << val << ",\"line\":" << line << "}," << endl;
}

// Recursive Call Stack Frame visualization SDK functions
void visualizer_push_frame_impl(const string& name, const string& args, int line = 0) {
    stepCount++;
    check_step_limit();
    cout << "{\"step\":" << stepCount << ",\"action\":\"push_frame\",\"name\":\"" << name << "\",\"args\":\"" << args << "\",\"line\":" << line << "}," << endl;
}

void visualizer_pop_frame_impl(int line = 0) {
    stepCount++;
    check_step_limit();
    cout << "{\"step\":" << stepCount << ",\"action\":\"pop_frame\",\"line\":" << line << "}," << endl;
}

// Tree serialization and traversal logging
void serializeTree(TreeNode* root) {
    if (!root) return;
    queue<TreeNode*> q;
    q.push(root);
    cout << "{\"step\": 0, \"action\": \"init_tree\", \"root\": \"" << root << "\"}," << endl;
    while (!q.empty()) {
        TreeNode* curr = q.front();
        q.pop();
        cout << "{\"step\": 0, \"action\": \"tree_node\", \"ptr\": \"" << curr << "\", \"val\": " << curr->val;
        if (curr->left) {
            cout << ", \"left\": \"" << curr->left << "\"";
            q.push(curr->left);
        } else {
            cout << ", \"left\": \"null\"";
        }
        if (curr->right) {
            cout << ", \"right\": \"" << curr->right << "\"";
            q.push(curr->right);
        } else {
            cout << ", \"right\": \"null\"";
        }
        cout << "}," << endl;
    }
}

void visit_impl(TreeNode* node, int line = 0) {
    if (!node) return;
    stepCount++;
    check_step_limit();
    cout << "{\"step\":" << stepCount << ",\"action\":\"visit_tree_node\",\"ptr\":\"" << node << "\",\"val\":" << node->val << ",\"line\":" << line << "}," << endl;
}

TreeNode* buildTree(const vector<string>& arr) {
    if (arr.empty() || arr[0] == "null") return nullptr;
    TreeNode* root = new TreeNode(stoi(arr[0]));
    queue<TreeNode*> q;
    q.push(root);
    int i = 1;
    while (!q.empty() && i < arr.size()) {
        TreeNode* curr = q.front();
        q.pop();
        if (i < arr.size() && arr[i] != "null") {
            curr->left = new TreeNode(stoi(arr[i]));
            q.push(curr->left);
        }
        i++;
        if (i < arr.size() && arr[i] != "null") {
            curr->right = new TreeNode(stoi(arr[i]));
            q.push(curr->right);
        }
        i++;
    }
    return root;
}

// Linked List serialization and traversal logging
void serializeList(ListNode* head) {
    if (!head) return;
    ListNode* curr = head;
    cout << "{\"step\": 0, \"action\": \"init_list\", \"head\": \"" << head << "\"}," << endl;
    while (curr) {
        cout << "{\"step\": 0, \"action\": \"list_node\", \"ptr\": \"" << curr << "\", \"val\": " << curr->val;
        if (curr->next) {
            cout << ", \"next\": \"" << curr->next << "\"";
        } else {
            cout << ", \"next\": \"null\"";
        }
        cout << "}," << endl;
        curr = curr->next;
    }
}

void focus_node_impl(ListNode* node, string label, int line = 0) {
    stepCount++;
    check_step_limit();
    cout << "{\"step\":" << stepCount << ",\"action\":\"focus_node\",\"ptr\":\"" << node << "\",\"label\":\"" << label << "\",\"line\":" << line << "}," << endl;
}

void update_next_impl(ListNode* from, ListNode* to, int line = 0) {
    stepCount++;
    check_step_limit();
    cout << "{\"step\":" << stepCount << ",\"action\":\"update_next\",\"from\":\"" << from << "\",\"to\":\"" << to << "\",\"line\":" << line << "}," << endl;
}

ListNode* buildList(const vector<int>& arr) {
    if (arr.empty()) return nullptr;
    ListNode* head = new ListNode(arr[0]);
    ListNode* curr = head;
    for (size_t i = 1; i < arr.size(); i++) {
        curr->next = new ListNode(arr[i]);
        curr = curr->next;
    }
    return head;
}

// Preprocessor wrappers to transparently track standard C++ structures
#define stack VisualizerStack
#define queue VisualizerQueue
#define deque VisualizerDeque
#define priority_queue VisualizerPriorityQueue

// Visualizer SDK helper macro overrides for capturing __LINE__
#define compare(i, j) compare_impl(i, j, __LINE__)
#define resolve(i, v) resolve_impl(i, v, __LINE__)
#define visit(n) visit_impl(n, __LINE__)
#define focus_cell(r, c) focus_cell_impl(r, c, __LINE__)
#define update_cell(r, c, val) update_cell_impl(r, c, val, __LINE__)
#define focus_node(node, label) focus_node_impl(node, label, __LINE__)
#define update_next(from, to) update_next_impl(from, to, __LINE__)
#define visit_graph(node) visit_graph_impl(node, __LINE__)
#define focus_graph_edge(u, v) focus_graph_edge_impl(u, v, __LINE__)
#define focus_pointer(label, idx) focus_pointer_impl(label, idx, __LINE__)
#define visualizer_push_frame(name, args) visualizer_push_frame_impl(name, args, __LINE__)
#define visualizer_pop_frame() visualizer_pop_frame_impl(__LINE__)

// USER CODE BEGIN
class Solution {
public:
    double findMedianSortedArrays(vector<int>& nums1, vector<int>& nums2) {
        int m = nums1.size(), n = nums2.size();
        if (m > n) return findMedianSortedArrays(nums2, nums1);
        int low = 0, high = m;

        while (true) {
            visit(0)
            focus_pointer("left", low);
            int midLeft = (low + high) / 2,
                midRight = m - midLeft;
            int l1 = getKthElement(nums1, midLeft),
                r1 = getKthElement(nums1, midLeft + 1),
                l2 = getKthElement(nums2, midRight),
                r2 = getKthElement(nums2, midRight + 1);
            if ((l1 <= l2 && l2 <= r1) || (r2 < r1)) {
                focus_pointer("left", low);
                low = midLeft + 1;
                visit(0)
            }
            else if ((l1 >= l2 && l2 >= r1) || (l1 > r2)) {
                focus_pointer("right", high);
                high = midLeft;
                visit(0)
            }
            else {
                compare(low, high);
                return findKthElement(nums1, nums2, (m + n - 1) / 2);
            }
        }
    }
    int getKthElement(vector<int>& nums, int k)
    {
        int start = 0, end = nums.size() - 1;
        while (true) {
            visit(start + (end - start) / 2);
            if (k == start + 1) return nums[start];
            else if (k &lt;= start + 1) end = start - 1;
            else k -= start + 1, start = start + 1;
        }
    }
};
// USER CODE END

int main() {
    string strInput = "";
    bool is_string_problem = false;
    vector<int> nums1 = {1, 32};
    vector<int> nums2 = {};
    global_nums = {};
    global_nums.insert(global_nums.end(), nums1.begin(), nums1.end());
    global_nums.insert(global_nums.end(), nums2.begin(), nums2.end());
    vector<int>& nums = global_nums;
    vector<string> tree_nodes = {"1", "32"};
    bool is_tree_problem = false;
    bool is_grid_problem = false;
    bool is_list_problem = false;
    bool is_graph_problem = false;
    bool is_heap_problem = false;
    bool is_map_problem = false;
    
    vector<pair<int,int>> graph_edges = {
        
    };
    vector<int> graph_vals(0, 0);
    for (int gi = 0; gi < 0; gi++) {
        if (gi < (int)global_nums.size()) graph_vals[gi] = global_nums[gi];
        else graph_vals[gi] = gi;
    }

    vector<vector<int>> grid = {
        {}
    };
    
    TreeNode* root = nullptr;
    if (is_tree_problem) {
        root = buildTree(tree_nodes);
    }
    
    ListNode* listHead = nullptr;
    if (is_list_problem) {
        vector<int> list_nums = {1, 32};
        listHead = buildList(list_nums);
    }
    
    VisualizerStack<> stack;
    
    cout << "{\"steps\": [" << endl;
    
    if (root) {
        serializeTree(root);
    }
    
    if (listHead) {
        serializeList(listHead);
    }
    
    if (is_graph_problem) {
        graph_init((int)graph_vals.size(), graph_vals);
        for (const auto& e : graph_edges) {
            graph_add_edge(e.first, e.second);
        }
    }

    if (is_grid_problem) {
        cout << "{\"step\": 0, \"action\": \"init_grid\", \"rows\": " << grid.size() << ", \"cols\": " << (grid.empty() ? 0 : grid[0].size()) << "}," << endl;
        for (int r = 0; r < grid.size(); r++) {
            for (int c = 0; c < grid[r].size(); c++) {
                cout << "{\"step\": 0, \"action\": \"grid_cell\", \"row\": " << r << ", \"col\": " << c << ", \"val\": " << grid[r][c] << "}," << endl;
            }
        }
    }
    
    if (!is_grid_problem && !is_graph_problem) {
        for (int i = 0; i < global_nums.size(); i++) {
            if (global_nums[i] != -9999) {
                cout << "{\"step\": 0, \"action\": \"focus_array\", \"index\": " << i << ", \"value\": " << global_nums[i] << "}," << endl;
            }
        }
    }
    
    Solution sol;
    sol.findMedianSortedArrays(nums1, nums2);
    
    cout << "{\"step\":999,\"action\":\"finish\"}" << endl;
    cout << "]}" << endl;
    return 0;
}
