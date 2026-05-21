
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

struct TreeNode {
    int val;
    TreeNode *left;
    TreeNode *right;
    TreeNode(int x) : val(x), left(NULL), right(NULL) {}
};

struct ListNode {
    int val;
    ListNode *next;
    ListNode(int x) : val(x), next(NULL) {}
};

vector<int> global_nums;
vector<int> graph_node_vals;
int stepCount = 0;

template<typename T = int>
class VisualizerStack {
public:
    void push(const T& val) {}
    void pop() {}
    T top() { return T(); }
    bool empty() { return true; }
};

template<typename T = int>
class VisualizerQueue {
public:
    void push(const T& val) {}
    void pop() {}
    T front() { return T(); }
    bool empty() { return true; }
};

template<typename T = int>
class VisualizerDeque {
public:
    void push_back(const T& val) {}
    void push_front(const T& val) {}
    void pop_back() {}
    void pop_front() {}
    T front() { return T(); }
    T back() { return T(); }
    bool empty() { return true; }
};

template<typename T = int, typename Container = vector<T>, typename Compare = less<T>>
class VisualizerPriorityQueue {
public:
    void push(const T& val) {}
    void pop() {}
    T top() { return T(); }
    bool empty() { return true; }
};

class VisualizerMap {
public:
    void put(int key, int val) {}
    int get(int key) { return 0; }
    void erase(int key) {}
    bool count(int key) { return false; }
    int& operator[](int key) { static int dummy = 0; return dummy; }
};

void focus_pointer_impl(const string& label, int idx, int line = 0) {}
void resolve_impl(int idx, int resolvedValue, int line = 0) {}
bool compare_impl(int idx1, int idx2, int line = 0) { return false; }
void focus_cell_impl(int r, int c, int line = 0) {}
void update_cell_impl(int r, int c, int val, int line = 0) {}
void visit_impl(TreeNode* node, int line = 0) {}
void visit_impl(int val, int line = 0) {}
void visit_graph_impl(int node, int line = 0) {}
void focus_graph_edge_impl(int u, int v, int line = 0) {}
void visualizer_push_frame_impl(const string& name, const string& args, int line = 0) {}
void visualizer_pop_frame_impl(int line = 0) {}

#define stack VisualizerStack
#define queue VisualizerQueue
#define deque VisualizerDeque
#define priority_queue VisualizerPriorityQueue

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

Here is the corrected instrumented code:

class Solution {
public:
    int lengthOfLongestSubstring(string s) {
        VisualizerMap<char> charIndex;
        int n = s.length(), left = 0, maxLength = 0, right = 0;
        while (right < n) {
            focus_pointer("left", left);
            focus_pointer("right", right);
            visit(right);
            if (charIndex.count(s[right])) {
                compare(left, charIndex[s[right]]);
                // Shift left pointer past the last seen index of the duplicate
                left = max(left, charIndex[s[right]] + 1);
            }
            charIndex[s[right]] = right;
            maxLength = max(maxLength, right - left + 1);
            resolve(right, maxLength);
            focus_pointer("right", right);
            right++;
        }
        return maxLength;
    }
};

int main() {
    return 0;
}
            